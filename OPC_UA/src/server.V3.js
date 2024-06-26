const opcua = require("node-opcua");
const {OPCUAServer, DataType, ObjectTypeIds} = opcua;
const axios = require('axios');

const requestOptions = {
    method: 'GET', url: 'https://weatherapi-com.p.rapidapi.com/current.json', params: {q: '53.1,-0.13'}, headers: {
        'X-RapidAPI-Key': '62d461ff03msh9fdcf142d22bbe3p1d265bjsnb2b490e6c8f2',
        'X-RapidAPI-Host': 'weatherapi-com.p.rapidapi.com'
    }
};

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

const timeoutApi = 120000;
(async () => {
    try {
        const server = new OPCUAServer({
            port: 26543, resourcePath: "/UA/RaspberryServer", buildInfo: {
                productName: "RaspberryOpcUAServer", buildDate: new Date(),
            }
        });

        await server.initialize();
        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        const meteoType = namespace.addObjectType({browseName: "MeteoType"});

        function addVariable(folder, browseName, dataType, typeDefinition) {
            namespace.addVariable({
                browseName,
                dataType,
                [typeDefinition === "property" ? 'propertyOf' : 'componentOf']: folder,
                modellingRule: "Mandatory"
            });
        }

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

        processTemplate(meteoType, responseTemplate.MeteoDataType);

        const devicesFolder = namespace.addFolder("ObjectsFolder", {browseName: "Devices"});
        const meteoInstance = meteoType.instantiate({browseName: "Meteo", organizedBy: devicesFolder});

        let lastCallTimestamp = 0;
        let data = null

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

        await fetchWeatherData()

        function getNestedValue(object, key) {
            if (object === null) {
                return undefined;
            }
            return key.split('.').reduce((o, i) => (o ? o[i] : undefined), object);
        }


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

        extractAllKeys(responseTemplate.MeteoDataType).forEach(key => bindVariable(key, meteoInstance));

        await server.start();
        console.log("Server started at: ", server.getEndpointUrl());
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
})();
