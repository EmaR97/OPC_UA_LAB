const {DefaultAzureCredential} = require("@azure/identity");
const {DigitalTwinsClient} = require("@azure/digital-twins-core");
const {inspect} = require("util");

const url = "https://example1.api.wcus.digitaltwins.azure.net";
const credential = new DefaultAzureCredential();
const serviceClient = new DigitalTwinsClient(url, credential);

let models_folder = "../resource/models/";
const building = require(models_folder + "building.json")
const level_sensor = require(models_folder + "level_sensor.json")
const pump = require(models_folder + "pump.json")
const tank = require(models_folder + "tank.json")

const buildingTwinId = "building1";
const tankTwinId = "tank1";
const pumpTwinId = "pump1";
const level_sensorTwinId = "level_sensor1";


async function main() {

    // Create models
    // const newModels = [building, level_sensor, pump, tank];
    // const model = await serviceClient.createModels(newModels);
    // console.log(`Created Model:`);
    // console.log(inspect(model));


// Create Digital Twins

    const MyPumpTwin = {
        $dtId: pumpTwinId, "$metadata": {
            "$model": "dtmi:example:Pump;1"
        }, Status: true,
    };

    const createdTwinPump = await serviceClient.upsertDigitalTwin(pumpTwinId, JSON.stringify(MyPumpTwin));
    console.log(`Created Digital Twin:`);
    console.log(inspect(createdTwinPump));

    const MyLevelSensorTwin = {
        $dtId: level_sensorTwinId, "$metadata": {
            "$model": "dtmi:example:LevelSensor;1"
        }, Level: 20,
    };

    const createdLevelSensorPump = await serviceClient.upsertDigitalTwin(level_sensorTwinId, JSON.stringify(MyLevelSensorTwin));
    console.log(`Created Digital Twin:`);
    console.log(inspect(createdLevelSensorPump));

    const MyTankTwin = {
        $dtId: tankTwinId, "$metadata": {
            "$model": "dtmi:example:Tank;1"
        }
    };

    const createdTwinTank = await serviceClient.upsertDigitalTwin(tankTwinId, JSON.stringify(MyTankTwin));
    console.log(`Created Digital Twin:`);
    console.log(inspect(createdTwinTank));

    const MyBuildingTwin = {
        $dtId: buildingTwinId, "$metadata": {
            "$model": "dtmi:example:Building;1"
        },
    };

    const createdTwinRoom = await serviceClient.upsertDigitalTwin(buildingTwinId, JSON.stringify(MyBuildingTwin));
    console.log(`Created Digital Twin:`);
    console.log(inspect(createdTwinRoom));

//Create Relationships

    const relationship1 = {
        $relationshipId: "BuildingContainsTank",
        $sourceId: buildingTwinId,
        $relationshipName: "contains",
        $targetId: tankTwinId
    };

    await serviceClient.upsertRelationship(
        relationship1["$sourceId"],
        relationship1["$relationshipId"],
        relationship1
    );


    const relationship2 = {
        $relationshipId: "TankContainsLevelSensor",
        $sourceId: tankTwinId,
        $relationshipName: "contains",
        $targetId: level_sensorTwinId
    };


    await serviceClient.upsertRelationship(
        relationship2["$sourceId"],
        relationship2["$relationshipId"],
        relationship2
    );
    const relationship3 = {
        $relationshipId: "TankContainPump",
        $sourceId: tankTwinId,
        $relationshipName: "contains",
        $targetId: pumpTwinId
    };


    await serviceClient.upsertRelationship(
        relationship3["$sourceId"],
        relationship3["$relationshipId"],
        relationship3
    );


}

main()