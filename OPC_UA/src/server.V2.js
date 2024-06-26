const port = 4334;

const opcua = require("node-opcua");

const userManager = {
    isValidUser: function (userName, password) {
        return userName === "user2" && password === "pas2" || userName === "user1" && password === "pas1";
    }, getUserRoles: function (username) {
        if (username === "user1") {
            return opcua.makeRoles("AuthenticatedUser;Observer;Operator");
        }
        if (username === "user2") {
            return opcua.makeRoles("AuthenticatedUser;Supervisor;SecurityAdmin");
        }
        return opcua.makeRoles("Anonymous");
    }
};

(async () => {
    try {
        // Step 1: Create and initialize the OPC UA server
        const server = new opcua.OPCUAServer({
            port: port, userManager, allowAnonymous: false, resourcePath: "/UA/MyLittleServer",
        });

        await server.initialize();

        // Step 2: Get the address space and define the namespace
        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        // Step 3: Define custom object types
        const BoilerType = namespace.addObjectType({browseName: "BoilerType"});
        const PipeType = namespace.addObjectType({
                browseName: "PipeType", subtypeOf:  "FolderType"
        });
        const TemperatureSensorType = namespace.addObjectType({browseName: "TemperatureSensorType"});


        // Step 5: Add variables to the pipes
        namespace.addVariable({
            organizedBy: PipeType, browseName: "Valve", dataType: opcua.DataType.Double, modellingRule: "Mandatory",
        });

        namespace.addVariable({
            organizedBy: PipeType, browseName: "Size", dataType: opcua.DataType.String, modellingRule: "Mandatory",
        });
        // Step 4: Add mandatory components to BoilerType
        const InputPipe = namespace.addObject({
            browseName: "InputPipe", componentOf: BoilerType, typeDefinition: PipeType, modellingRule: "Mandatory",
        });

        const OutputPipe = namespace.addObject({
            browseName: "OutputPipe", componentOf: BoilerType, typeDefinition: PipeType, modellingRule: "Mandatory",
        });

        const BoilerDrum = namespace.addObject({
            browseName: "BoilerDrum",
            componentOf: BoilerType,
            typeDefinition: opcua.ObjectTypeIds.FolderType,
            modellingRule: "Mandatory",
        });


        // Step 6: Add variables and properties to TemperatureSensorType
        namespace.addVariable({
            componentOf: TemperatureSensorType,
            browseName: "Temperature",
            dataType: opcua.DataType.Double,
            modellingRule: "Mandatory",
        });

        namespace.addVariable({
            propertyOf: TemperatureSensorType,
            browseName: "Model",
            dataType: opcua.DataType.String,
            modellingRule: "Mandatory",
        });

        // Step 7: Add TemperatureSensor to BoilerDrum
        namespace.addObject({
            browseName: "TemperatureSensor",
            organizedBy: BoilerDrum,
            typeDefinition: TemperatureSensorType,
            modellingRule: "Mandatory",
        });


        // Step 8: Instantiate BoilerType in the correct folder
        const BoilerInstance = BoilerType.instantiate({
            browseName: "BoilerInstance", organizedBy: addressSpace.rootFolder.objects, // Correctly referencing the root folder
        });


        // Step 9: Bind variables (example: random temperature value)
        const randomTemperature = {
            get() {
                return new opcua.Variant({
                    dataType: opcua.DataType.Double, value: Math.random() * 100, // Random temperature between 0 and 100
                });
            },
        };

        BoilerInstance.boilerDrum.temperatureSensor.temperature.bindVariable(randomTemperature, true);

        // Step 10: Start the server
        await server.start();
        console.log("Server started at:", server.getEndpointUrl());

    } catch (error) {
        console.error("Error starting OPC UA server:", error);
        process.exit(1);
    }
})();
