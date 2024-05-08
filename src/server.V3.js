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

        // Step 10: Start the server
        await server.start();
        console.log("Server started at:", server.getEndpointUrl());

    } catch (error) {
        console.error("Error starting OPC UA server:", error);
        process.exit(1);
    }
})();
