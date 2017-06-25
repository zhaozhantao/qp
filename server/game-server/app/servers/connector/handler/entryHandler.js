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
    console.log("uid为", uid);
    session.set("roomId", 1);
    RoomData.enter("1", uid);
    var channel = this.channelService.getChannel("roomChannel_1", true);
    channel.pushMessage("onEnterRoom", {uid:uid});
    channel.add(uid, this.app.get('serverId'));
    next(null, {ret:0, data:RoomData.data});
}
