var RoomData = require("../../commSrc/data/RoomData");
var GamePlayerUi = require("./GamePlayerUi");
var GamePlayerUi = require("./GamePlayerUi");
cc.Class({
    extends: cc.Component,

    properties: {
        chairs:{default:[],type:cc.Node},
        GamePlayerPrefab:cc.Prefab,
        prepareButton:cc.Button,
        optNode:cc.Node,
        lookBtn:cc.Button,
        compareBtn:cc.Button,
        followBtn:cc.Button,
        addBtn:cc.Button,
        giveupBtn:cc.Button,
    },

    // use this for initialization
    onLoad: function () {
        this.chairUis = [];
        for (var i = this.chairs.length - 1; i >= 0; i--) {
            this.chairUis[i] = cc.instantiate(this.GamePlayerPrefab);
            this.chairUis[i].parent = this.chairs[i];
        }

        for(var i=0; i < 5; i++) {
            this.chairUis[i].getComponent(GamePlayerUi).setLocalChairIndex(i);
        }

        this.registPomeloOn();
        // 刷新按钮状态
        this.refreshButton();
    },
    // 当被消毁的时候调用
    onDestroy:function(){
        pomelo.off("onEnterRoom");
    },
    // 注册pomelo监听
    registPomeloOn:function(){
        pomelo.on("onEnterRoom", this.onEnterRoom.bind(this));
        pomelo.on("onExitRoom", this.onExitRoom.bind(this));
        pomelo.on("onPrepare", this.onPrepare.bind(this));
        pomelo.on("onDispatch", this.onDispatch.bind(this));
    },
    // 有玩家进入房间
    onEnterRoom:function(data){
        console.log("onEnterRoom", data);
        RoomData.enter(data.chair, data.uid, data.gold);

        var localChair = (data.chair - RoomData.myChair+5)%5;
        this.chairs[localChair].active = true;
        this.chairUis[localChair].getComponent(GamePlayerUi).initUi();
    },
    // 有玩家退出房间
    onExitRoom:function(data){
        console.log("onExitRoom", data);
        RoomData.exit(data.chair);

        var localChair = (data.chair - RoomData.myChair+5)%5;
        this.chairs[localChair].active = false;
    },
    // 有玩家退出房间
    onPrepare:function(data){
        console.log("onPrepare", data);
        RoomData.prepare(data.chair);

        var localChair = (data.chair - RoomData.myChair+5)%5;
        this.chairUis[localChair].getComponent("GamePlayerUi").prepare();
    },
    // 开始游戏（发牌）
    onDispatch:function(data){
        console.log("onDispatch", data);
        RoomData.start();

        for (var i = 0; i < 5; i++) {
            var player = RoomData.data.chr[i];
            if (player != null && player.pre == true) {
                var localChair = (i - RoomData.myChair+5)%5;
                this.chairUis[localChair].getComponent("GamePlayerUi").dispatch();

            }
        }
        this.refreshButton();
    },

    // 点击了准备
    onPrepareClick:function(){
        var self = this;
        pomelo.request("connector.entryHandler.prepare", {}, function(){
            self.refreshButton();
        });
    },
    // 刷新按钮状态
    refreshButton:function() {
        var myChairData = RoomData.data.chr[RoomData.myChair];
        this.prepareButton.node.active = ((RoomData.data.ing != true) && myChairData.pre != true);
        this.optNode.active = (RoomData.data.ing == true);
        this.lookBtn.interactable = (myChairData.look != true);
        this.compareBtn.interactable = (RoomData.data.s == RoomData.myChair);
        this.followBtn.interactable = (RoomData.data.s == RoomData.myChair);
        this.addBtn.interactable = (RoomData.data.s == RoomData.myChair);
        this.giveupBtn.interactable = (RoomData.data.s == RoomData.myChair);
    },
});
