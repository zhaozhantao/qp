var RoomData = require("../../commSrc/data/RoomData");
cc.Class({
    extends: cc.Component,

    properties: {
        chairs:{default:[],type:cc.Node},
        GamePlayerPrefab:cc.Prefab,
    },

    // use this for initialization
    onLoad: function () {
        this.chairUis = [];
        for (var i = this.chairs.length - 1; i >= 0; i--) {
            this.chairUis[i] = cc.instantiate(this.GamePlayerPrefab);
            this.chairUis[i].parent = this.chairs[i];
        }

        for(var i=0; i < 5; i++) {
            // 本地椅子号转服务器椅子号
            var serverChair = (RoomData.myChair + i)%5;
            if (RoomData.data[RoomData.roomId].chr[serverChair] != null) {
                this.chairs[i].active = true;
            } else {
                this.chairs[i].active = false;
            }
        }
    },

});
