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
            if (RoomData.data.chr[serverChair] != null) {
                this.chairs[i].active = true;
            } else {
                this.chairs[i].active = false;
            }
        }

        this.registPomeloOn();
    },
    // 当被消毁的时候调用
    onDestroy:function(){
        pomelo.off("onEnterRoom");
    },
    // 注册pomelo监听
    registPomeloOn:function(){
        pomelo.on("onEnterRoom", this.onEnterRoom.bind(this));
    },
    // 有玩家进入房间
    onEnterRoom:function(data){
        console.log("onEnterRoom", data);
        RoomData.enter(data.chair, data.uid, data.gold);

        var localChair = (data.chair - RoomData.myChair+5)%5;
        this.chairs[localChair].active = true;
    },

});
