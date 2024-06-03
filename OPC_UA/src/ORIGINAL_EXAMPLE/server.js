const opcua = require("node-opcua");


const userManager = {
    isValidUser: function(userName, password) {
        if (userName === "user1" && password === "pas1") {
            return true;
        }
        if (userName === "user2" && password === "pas2") {
            return true;
        }
        return false;
    },
    getUserRoles: function(username) {
        if (username === "user1") {
            return opcua.makeRoles("AuthenticatedUser;Observer;Operator");
        }
        if (username === "user2") {
            return opcua.makeRoles("AuthenticatedUser;Supervisor;SecurityAdmin");
        }
        return opcua.makeRoles("Anonymous");
    }
};


(async()=>{
    try {

        const server = new opcua.OPCUAServer({
            port: 4334,
            userManager,
            allowAnonymous: false,
            resourcePath: "/UA/MyLittleServer",
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

        var model = namespace.addVariable({
            propertyOf: temperatureSensorType,
            browseName: 'model',
            dataType: opcua.DataType.String,
            modellingRule: 'Mandatory',
        });


        var temperature = namespace.addVariable({
            componentOf: temperatureSensorType,
            browseName: 'Temperature',
            dataType: opcua.DataType.Double,
            modellingRule: 'Mandatory',
        });



        //Creo istanza di temperatureSensorType
        var temperatureSensor = temperatureSensorType.instantiate({
            browseName: "MyTemperatureSensor",
            organizedBy: objectFolder,
        });

        temperatureSensor.model.setValueFromSource({
            dataType: opcua.DataType.String,
            value: "1-Way",
        });


        var optionBind={
            get: function(){
                return new opcua.Variant({dataType: opcua.DataType.Double, value: 60*Math.random()});
            }

        }

        temperatureSensor.temperature.bindVariable(optionBind,true);

        await server.start();
        console.log("server started at ", server.getEndpointUrl());

    } catch(err) {
        console.log(err);
        process.exit(1);
    }
})();