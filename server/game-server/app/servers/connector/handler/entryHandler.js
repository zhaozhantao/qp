var RoomData = require("../../../data/RoomData");
module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
    this.channelService = app.get("channelService");
};

Handler.prototype.entry = function(msg, session, next) {
    next(null, {code: 200, msg: 'game server is ok.'});
};

// 登录
Handler.prototype.login = function(msg, session, next) {
    var username = msg.username;
    session.bind(username, function(){
        next(null, {ret: 0});
    });
}
// 进入房间
Handler.prototype.enterRoom = function(msg, session, next) {
    var uid = session.uid;
    var sid = this.app.get('serverId');
    var roomId = "1";
    console.log("uid为", uid);
    var chair = RoomData.enter(roomId, uid);
    session.set("roomId", roomId);
    session.set("chair", chair);
    session.pushAll();
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    channel.pushMessage("onEnterRoom", {uid:uid,chair:chair,gold:1000});
    channel.add(uid, sid);
    next(null, {ret:0, data:{roomId:roomId,chair:chair,roomData:RoomData.data[roomId]}});

    // 断开时的处理
    session.on("closed", function() {
        channel.leave(uid, sid);
        RoomData.exit(roomId, chair);
        channel.pushMessage("onExitRoom", {chair:chair});
    });
}

// 准备
Handler.prototype.prepare = function(msg, session, next) {
    var uid = session.uid;
    var roomId = session.get("roomId");
    var chair = session.get("chair");
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    RoomData.prepare(roomId, chair);
    channel.pushMessage("onPrepare", {chair:chair});
    next(null, {ret:0});
}
