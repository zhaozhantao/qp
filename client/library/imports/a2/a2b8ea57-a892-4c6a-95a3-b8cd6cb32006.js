"use strict";

var Comm = require("../../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {},

    onRoom1Click: function onRoom1Click() {
        pomelo.request("connector.entryHandler.enterRoom", {}, function (data) {
            if (data.ret == 0) {
                Comm.scene.enterRoom();
            }
        });
    }
});