"use strict";

var RoomData = require("../../commSrc/data/RoomData");
var Comm = require("../../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {},

    onRoom1Click: function onRoom1Click() {
        pomelo.request("connector.entryHandler.enterRoom", {}, function (data) {
            if (data.ret == 0) {
                console.log(data.data.roomData);
                console.log(data.data.chair);
                console.log(data.data.roomId);
                RoomData.data = data.data.roomData;
                RoomData.myChair = data.data.chair;
                RoomData.roomId = data.data.roomId;
                Comm.scene.enterRoom();
            }
        });
    }
});