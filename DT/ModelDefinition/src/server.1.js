const {DefaultAzureCredential} = require("@azure/identity");
const {DigitalTwinsClient} = require("@azure/digital-twins-core");
const {inspect} = require("util");
const path = require("path");

const url = "https://Example.api.wcus.digitaltwins.azure.net";
const credential = new DefaultAzureCredential();
const serviceClient = new DigitalTwinsClient(url, credential);

const modelsFolder = "../resource/models/";
const models = ["building.json", "level_sensor.json", "pump.json", "valve.json", "tank.json", "flow_sensor.json"].map(model => require(path.join(modelsFolder, model)));

const twinIds = {
    building: "building1",
    tank: "tank1",
    pump: "pump1",
    valve: "valve1",
    levelSensor: "levelSensor1",
    pumpFlowSensor: "pumpFlowSensor1",
    valveFlowSensor: "valveFlowSensor1"
};

const twins = {
    pump: {
        $dtId: twinIds.pump, $metadata: {$model: "dtmi:example:Pump;1"}, Status: true
    }, valve: {
        $dtId: twinIds.valve, $metadata: {$model: "dtmi:example:Valve;1"}, Aperture: 50
    }, levelSensor: {
        $dtId: twinIds.levelSensor, $metadata: {$model: "dtmi:example:LevelSensor;1"}, Level: 20
    }, pumpFlowSensor: {
        $dtId: twinIds.pumpFlowSensor, $metadata: {$model: "dtmi:example:FlowSensor;1"}, FlowRate: 0
    }, valveFlowSensor: {
        $dtId: twinIds.valveFlowSensor, $metadata: {$model: "dtmi:example:FlowSensor;1"}, FlowRate: 0
    }, tank: {
        $dtId: twinIds.tank, $metadata: {$model: "dtmi:example:Tank;1"}, level: 20
    }, building: {
        $dtId: twinIds.building, $metadata: {$model: "dtmi:example:Building;1"}
    }
};

const relationships = [{
    $relationshipId: "BuildingHasTank",
    $sourceId: twinIds.building,
    $relationshipName: "hasTank",
    $targetId: twinIds.tank
}, {
    $relationshipId: "TankHasLevelSensor",
    $sourceId: twinIds.tank,
    $relationshipName: "hasLevelSensor",
    $targetId: twinIds.levelSensor
}, {
    $relationshipId: "TankHasPump", $sourceId: twinIds.tank, $relationshipName: "hasPump", $targetId: twinIds.pump
}, {
    $relationshipId: "TankHasValve", $sourceId: twinIds.tank, $relationshipName: "hasValve", $targetId: twinIds.valve
}, {
    $relationshipId: "PumpHasFlowSensor",
    $sourceId: twinIds.pump,
    $relationshipName: "hasFlowSensor",
    $targetId: twinIds.pumpFlowSensor
}, {
    $relationshipId: "ValveHasFlowSensor",
    $sourceId: twinIds.valve,
    $relationshipName: "hasFlowSensor",
    $targetId: twinIds.valveFlowSensor
}];

async function createModels() {
    try {
        const createdModels = await serviceClient.createModels(models);
        console.log("Created Models:");
        console.log(inspect(createdModels));
    } catch (error) {
        console.error("Error creating models:", error);
    }
}

async function createTwins() {
    try {
        for (const [key, twin] of Object.entries(twins)) {
            const createdTwin = await serviceClient.upsertDigitalTwin(twin.$dtId, JSON.stringify(twin));
            console.log(`Created ${key} Twin:`);
            console.log(inspect(createdTwin));
        }
    } catch (error) {
        console.error("Error creating twins:", error);
    }
}

async function createRelationships() {
    try {
        for (const relationship of relationships) {
            await serviceClient.upsertRelationship(relationship.$sourceId, relationship.$relationshipId, relationship);
            console.log(`Created Relationship: ${relationship.$relationshipId}`);
        }
    } catch (error) {
        console.error("Error creating relationships:", error);
    }
}

async function main() {
    await createModels();
    await createTwins();
    await createRelationships();
}

main().catch(console.error);
