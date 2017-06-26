module.exports = {
    data : {chr:[null,null,null,null]},
    // 进入房间
    enter : function(chair, uid, gold){
        this.data.chr[chair] = {uid:uid,gold:gold};
    },
    // 退出房间
    exit : function(chair){
        this.data.chr[chair] = null;
    },
    // 准备
    prepare:function(chair) {
        this.data.chr[chair].pre = true;
    },
    // 发牌,开始
    start:function () {
        this.data.ing = true;
    },
    // 设置发言人
    setSpeaker:function(speaker, speakerTime) {
        this.data.s = speaker;
        this.data.st = speakerTime;
    },

};
