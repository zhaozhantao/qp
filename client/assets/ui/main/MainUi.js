var Comm = require("../../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {
    },

    onRoom1Click:function(){
        pomelo.request("connector.entryHandler.enterRoom", {}, function(data){
            if (data.ret == 0) {
                Comm.scene.enterRoom();
            }
        });
    },
});
