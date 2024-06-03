// Import required libraries and modules
const opcua = require("node-opcua");
const {OPCUAServer, DataType, ObjectTypeIds} = opcua;
const axios = require('axios');
const {
    PubSubConfigurationDataType,
    DataSetFieldContentMask,
    JsonDataSetMessageContentMask,
    JsonNetworkMessageContentMask,
    BrokerTransportQualityOfService,
    PublishedDataItemsDataType
} = require("node-opcua-types");
const {MyMqttJsonPubSubConnectionDataType, Transport} = require("node-opcua-pubsub-expander");
const {resolveNodeId, AttributeIds} = require("node-opcua");
const {installPubSub} = require("node-opcua-pubsub-server");

// Configuration for fetching weather data
const requestOptions = {
    method: 'GET', url: 'https://weatherapi-com.p.rapidapi.com/current.json', params: {q: '53.1,-0.13'}, headers: {
        'X-RapidAPI-Key': '62d461ff03msh9fdcf142d22bbe3p1d265bjsnb2b490e6c8f2',
        'X-RapidAPI-Host': 'weatherapi-com.p.rapidapi.com'
    }
};

// Template for the expected response from the weather API
const responseTemplate = {
    "MeteoDataType": {
        "location": {
            "name": [DataType.String, "property"],
            "region": [DataType.String, "property"],
            "country": [DataType.String, "property"],
            "lat": [DataType.Double, "property"],
            "lon": [DataType.Double, "property"],
            "tz_id": [DataType.String, "property"],
            "localtime_epoch": [DataType.Double, "component"],
            "localtime": [DataType.String, "component"]
        }, "current": {
            "last_updated_epoch": [DataType.Double, "component"],
            "last_updated": [DataType.String, "component"],
            "temp_c": [DataType.Double, "component"],
            "temp_f": [DataType.Double, "component"],
            "is_day": [DataType.Double, "component"],
            "condition": {
                "text": [DataType.String, "property"],
                "icon": [DataType.String, "property"],
                "code": [DataType.Double, "property"]
            },
            "wind_mph": [DataType.Double, "component"],
            "wind_kph": [DataType.Double, "component"],
            "wind_degree": [DataType.Double, "component"],
            "wind_dir": [DataType.String, "property"],
            "pressure_mb": [DataType.Double, "component"],
            "pressure_in": [DataType.Double, "component"],
            "precip_mm": [DataType.Double, "component"],
            "precip_in": [DataType.Double, "component"],
            "humidity": [DataType.Double, "component"],
            "cloud": [DataType.Double, "component"],
            "feelslike_c": [DataType.Double, "component"],
            "feelslike_f": [DataType.Double, "component"],
            "vis_km": [DataType.Double, "component"],
            "vis_miles": [DataType.Double, "component"],
            "uv": [DataType.Double, "component"],
            "gust_mph": [DataType.Double, "component"],
            "gust_kph": [DataType.Double, "component"]
        }
    }
};

// Timeout for API call
const timeoutApi = 120000;

// Main function
(async () => {
    try {
        // Create OPC UA server
        const server = new OPCUAServer({
            port: 26543, resourcePath: "/UA/RaspberryServer", buildInfo: {
                productName: "RaspberryOpcUAServer", buildDate: new Date(),
            }
        });

        // Initialize server
        await server.initialize();
        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        // Define MeteoType object type
        const meteoType = namespace.addObjectType({browseName: "MeteoType"});

        // Function to add variable to object
        function addVariable(folder, browseName, dataType, typeDefinition) {
            namespace.addVariable({
                browseName,
                dataType,
                [typeDefinition === "property" ? 'propertyOf' : 'componentOf']: folder,
                modellingRule: "Mandatory"
            });
        }

        // Function to process response template and add variables
        function processTemplate(folder, template) {
            for (const [key, value] of Object.entries(template)) {
                if (Array.isArray(value)) {
                    addVariable(folder, key, value[0], value[1]);
                } else {
                    const subFolder = namespace.addObject({
                        browseName: key,
                        componentOf: folder,
                        typeDefinition: ObjectTypeIds.FolderType,
                        modellingRule: "Mandatory"
                    });
                    processTemplate(subFolder, value);
                }
            }
        }

        // Process response template to create variables
        processTemplate(meteoType, responseTemplate.MeteoDataType);

        // Create folder for devices
        const devicesFolder = namespace.addFolder("ObjectsFolder", {browseName: "Devices"});
        const meteoInstance = meteoType.instantiate({browseName: "Meteo", organizedBy: devicesFolder});

        // Variables to store last API call timestamp and data
        let lastCallTimestamp = 0;
        let data = null;

        // Function to fetch weather data from API
        async function fetchWeatherData() {
            if (Date.now() - lastCallTimestamp > timeoutApi) {
                try {
                    data = (await axios.request(requestOptions)).data;
                } catch (error) {
                    console.error('Error fetching weather data:', error);
                } finally {
                    lastCallTimestamp = Date.now();
                }
            }
            return data;
        }

        // Fetch weather data initially
        await fetchWeatherData();

        // Function to retrieve nested value from object using dot notation
        function getNestedValue(object, key) {
            if (object === null) {
                return undefined;
            }
            return key.split('.').reduce((o, i) => (o ? o[i] : undefined), object);
        }

        // Function to bind variable to fetched weather data
        function bindVariable(key, object) {
            const element = getNestedValue(object, key);
            const binding = {
                refreshFunc: async function (callback) {
                    const data = await fetchWeatherData();
                    const dataValue = new opcua.DataValue({
                        value: new opcua.Variant({
                            dataType: element.dataType.value, value: getNestedValue(data, key)
                        }), sourceTimestamp: new Date()
                    });
                    callback(null, dataValue);
                }
            };
            element.bindVariable(binding, true);
        }

        // Function to extract all keys from response template
        function extractAllKeys(obj, parentKey = '', result = []) {
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    let newKey = parentKey ? `${parentKey}.${key}` : key;
                    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                        extractAllKeys(obj[key], newKey, result);
                    } else {
                        result.push(newKey);
                    }
                }
            }
            return result;
        }

        // Extract all keys from response template
        let allKeys = extractAllKeys(responseTemplate.MeteoDataType);

        // Bind variables to meteoInstance using allKeys
        allKeys.forEach(key => bindVariable(key, meteoInstance));

        // Enable Pub-Sub service
        const configuration = getPubSubConfiguration(meteoInstance,allKeys);
        await installPubSub(server, { configuration });
        await server.start();
        console.log("Server started at: ", server.getEndpointUrl());
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
})();

// Function to create Pub-Sub configuration
function getPubSubConfiguration(node, keys) {
    const connection = createConnection(); // Create the connection
    const publishedDataSet = createPublishedDataSet(node, keys); // Create the published dataset
    return new PubSubConfigurationDataType({
        connections: [connection], publishedDataSets: [publishedDataSet]
    });
}

// Function to create connection for Pub-Sub
function createConnection() {
    const mqttEndpoint = "mqtt:localhost:1883"; // MQTT endpoint

    // Create the dataset writer
    const dataSetWriter = {
        dataSetFieldContentMask: DataSetFieldContentMask.None,
        dataSetName: "PublishedDataSet1",
        dataSetWriterId: 1,
        enabled: true,
        name: "dataSetWriter1",
        messageSettings: {
            dataSetMessageContentMask: JsonDataSetMessageContentMask.DataSetWriterId | JsonDataSetMessageContentMask.MetaDataVersion,
        },
        transportSettings: {
            queueName: "test/topic",
        },
    };

    // Create the writer group
    const writerGroup = {
        dataSetWriters: [dataSetWriter],
        enabled: true,
        publishingInterval: 1000,
        name: "WriterGroup1",
        messageSettings: {
            networkMessageContentMask: JsonNetworkMessageContentMask.PublisherId,
        },
        transportSettings: {
            requestedDeliveryGuarantee: BrokerTransportQualityOfService.AtMostOnce,
        },
    };

    // Create the connection
    const connection = new MyMqttJsonPubSubConnectionDataType({
        enabled: true, name: "Connection1", transportProfileUri: Transport.MQTT_JSON, address: {
            url: mqttEndpoint,
        }, writerGroups: [writerGroup], readerGroups: []
    });
    return connection;
}

// Function to retrieve nested value from object using dot notation
function getNestedValue(object, key) {
    if (object === null) {
        return undefined;
    }
    return key.split('.').reduce((o, i) => (o ? o[i] : undefined), object);
}

// Function to create published dataset
function createPublishedDataSet(node, keys) {
    const fields = keys.map(key => {
        const nodeElement = getNestedValue(node, key);
        return {
            name: key,
            builtInType: DataType[nodeElement.dataType.toString()],
            dataType: resolveNodeId(nodeElement.dataType.toString()),
        };
    });
    const publishedData = keys.map(key => {
        const nodeElement = getNestedValue(node, key);
        return {
            attributeId: AttributeIds.Value,
            samplingIntervalHint: 7000,
            publishedVariable: nodeElement.nodeId,
        };
    });
    return {
        name: "PublishedDataSet1",
        dataSetMetaData: { fields },
        dataSetSource: new PublishedDataItemsDataType({ publishedData }),
    };
}

