//比牌，必须是按点数升序的牌
var compareCard = module.exports;
// 比牌，如果相同，则认为后者赢，返回true认为前者赢
compareCard.do = function (card1, card2) {
    var card1Type = compareCard.typeofCard(card1);
    var card2Type = compareCard.typeofCard(card2);
    if (card1Type != card2Type) {
        return card1Type > card2Type;
    }
    return compareCard["compareType" + card1Type](card1,card2);
};
// 判断是哪种类型的牌，0为普通牌
compareCard.typeofCard = function (cardArr) {
    for(i = 5; i >= 1; i--){
        if (compareCard["isType"+ i](cardArr)) {
            return i;
        }
    }
    return 0;
};
// 是不是对子（前提是已经判断是不是豹子）
compareCard.isType1 = function (cardArr) {
    return (cardArr[0][1] == cardArr[1][1]) || (cardArr[0][1] == cardArr[2][1]) || (cardArr[1][1] == cardArr[2][1]);
}
// 是不是顺子（前提是已经判断是不是豹子）
compareCard.isType2 = function (cardArr) {
    return cardArr[1][1] - cardArr[0][1] == 1 && cardArr[2][1] - cardArr[1][1] == 1;
}
// 是不是同花
compareCard.isType3 = function (cardArr) {
    return (cardArr[0][0] == cardArr[1][0]) && (cardArr[0][0] == cardArr[2][0]);
}
// 是不是同花顺
compareCard.isType4 = function (cardArr) {
    return compareCard.isType3(cardArr) && compareCard.isType2(cardArr);
}
// 是不是豹子
compareCard.isType5 = function (cardArr) {
    return (cardArr[0][1] == cardArr[1][1]) && (cardArr[0][1] == cardArr[2][1]);
}
// 比较两个普通牌
compareCard.compareType0 = function (cardArr1, cardArr2) {
    if(cardArr1[2][1] != cardArr2[2][1]) {
        return cardArr1[2][1] > cardArr2[2][1];
    }
    if(cardArr1[1][1] != cardArr2[1][1]) {
        return cardArr1[1][1] > cardArr2[1][1];
    }
    return cardArr1[0][1] > cardArr2[0][1];
}
// 比较两个对子牌
compareCard.compareType1 = function (cardArr1, cardArr2) {
    var same1 = cardArr1[1][1];
    var same2 = cardArr2[1][1];
    if (same1 != same2) {
        return same1 > same2;
    }
    var single1 = cardArr1[0][1];
    if (cardArr1[0][1] ==same1) {
        single1 = cardArr1[2][1];
    }
    var single2 = cardArr2[0][1];
    if (cardArr2[0][1] ==same2) {
        single2 = cardArr2[2][1];
    }
    return single1 > single2;
}
// 比较两个顺子牌
compareCard.compareType2 = function (cardArr1, cardArr2) {
    return cardArr1[0][1] > cardArr2[0][1];
}
// 比较两个同花牌
compareCard.compareType3 = function (cardArr1, cardArr2) {
    return compareCard.compareType0(cardArr1, cardArr2);
}
// 比较两个同花顺牌
compareCard.compareType4 = function (cardArr1, cardArr2) {
    return compareCard.compareType2(cardArr1, cardArr2);
}
// 比较两个豹子牌
compareCard.compareType5 = function (cardArr1, cardArr2) {
    return cardArr1[0][1] > cardArr2[0][1];
}