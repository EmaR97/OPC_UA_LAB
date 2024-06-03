const opcua = require("node-opcua");

const aspace = "./aspace.xml"


var xmlFiles = [opcua.nodesets.standard, aspace];


(async () => {
    try {

        const server = new opcua.OPCUAServer({
            port: 4335, resourcePath: "/UA/MyLittleServer", nodeset_filename: xmlFiles,
        });

        await server.initialize();

        const addressSpace = server.engine.addressSpace


        const mySensor = addressSpace.findNode('ns=2;i=5007')

        // console.log(mySensor)
        mySensor.boiler_drum.temperature_sensor.temperature.setValueFromSource({
            dataType: opcua.DataType.Float, value: 20
        });
        // console.log(mySensor.boiler_drum.temperature_sensor.temperature)

        mySensor.boiler_drum.temperature_sensor.model.setValueFromSource({
            dataType: opcua.DataType.String, value: "1ABB3"
        });
        // console.log(mySensor.boiler_drum.temperature_sensor.model)
        setInterval(() => {
            var value = 60 * Math.random();
            mySensor.boiler_drum.temperature_sensor.temperature.setValueFromSource({
                dataType: opcua.DataType.Float, value
            });
        }, 1000);


        await server.start();
        console.log("server started at ", server.getEndpointUrl());

    } catch (err) {
        console.log(err);
        process.exit(1);
    }
})();