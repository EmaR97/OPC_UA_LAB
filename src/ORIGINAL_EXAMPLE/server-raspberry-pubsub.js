const opcua = require("node-opcua");
const {OPCUAServer, dataType, DataType, resolveNodeId, AttributeIds} = require("node-opcua");
const {
    DataSetFieldContentMask,
    JsonDataSetMessageContentMask,
    JsonNetworkMessageContentMask,
    BrokerTransportQualityOfService,
    PublishedDataItemsDataType,
    PubSubConfigurationDataType
} = require("node-opcua-types");
const {MyMqttJsonPubSubConnectionDataType, Transport} = require("node-opcua-pubsub-expander");
const {installPubSub} = require("node-opcua-pubsub-server");


(async () => {
    try {

        const server = new OPCUAServer({
            port: 26543, resourcePath: "/UA/RaspberryServer", buildInfo: {
                productName: "RaspberryOpcUAServer", buildDate: new Date(),
            }
        });

        await server.initialize();

        const addressSpace = server.engine.addressSpace
        const namespace = addressSpace.getOwnNamespace();

        var objectFolder = namespace.addFolder("ObjectsFolder", { //Folder
            browseName: "Devices"
        });

        //Creo l'ObjectType
        var temperatureSensorType = namespace.addObjectType({
            browseName: "TemperatureSensorType"
        });

        var temperature = namespace.addVariable({
            componentOf: temperatureSensorType,
            browseName: 'Temperature',
            dataType: opcua.DataType.Double,
            modellingRule: 'Mandatory',
            historizing: true,
            minimumSamplingInterval: 5000,
        });


        //Creo istanza di temperatureSensorType
        var temperatureSensor = temperatureSensorType.instantiate({
            browseName: "MyTemperatureSensor", organizedBy: objectFolder,
        });

        var optionBind = {
            refreshFunc: function (callback) {
                const value=5
                console.log(value);
                let dataValue = new opcua.DataValue({
                    value: new opcua.Variant({dataType: opcua.DataType.Double, value: value}),
                    sourceTimestamp: new Date()
                })
                callback(null, dataValue)

            }
        }

        temperatureSensor.temperature.bindVariable(optionBind, true);


        console.log(temperatureSensor.temperature)


        //"enable pub-sub service"
        const configuration = getPubSubConfiguration(temperatureSensor.temperature.nodeId);
        //
        await installPubSub(server, {
            configuration,
        });


        await server.start();

        console.log("server started at ", server.getEndpointUrl());
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
})();

function getPubSubConfiguration(nodeid) {

    //_"create the connection"
    const connection = createConnection();

    //_"create the published dataset";
    const publishedDataSet = createPublishedDataSet(nodeid);

    return new PubSubConfigurationDataType({
        connections: [connection], publishedDataSets: [publishedDataSet]
    });
}

function createConnection() {

    const mqttEndpoint = "mqtt:broker.hivemq.com:1883";

    //"create the writer group";
    //"create the dataset writer"
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
            queueName: "stervfive-opcua-demo/json/data/temperature-sensor1",
        },
    };

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

    const connection = new MyMqttJsonPubSubConnectionDataType({
        enabled: true, name: "Connection1", transportProfileUri: Transport.MQTT_JSON, address: {
            url: mqttEndpoint,
        }, writerGroups: [writerGroup], readerGroups: []
    });
    return connection;
}


function createPublishedDataSet(nodeid) {
    const publishedDataSet = {
        name: "PublishedDataSet1", dataSetMetaData: {
            fields: [{
                name: "Sensor.Temperature", builtInType: DataType.Double, dataType: resolveNodeId("Double"),
            },],
        }, dataSetSource: new PublishedDataItemsDataType({
            publishedData: [{
                attributeId: AttributeIds.Value, samplingIntervalHint: 7000, publishedVariable: nodeid,
            },],
        }),
    };
    return publishedDataSet;
}



