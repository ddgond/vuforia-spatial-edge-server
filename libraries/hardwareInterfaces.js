﻿/**
 *   Created by Carsten on 12/06/2015.
 *   Modified by Valentin Heun on 16/08/16.
 **
 *   Copyright (c) 2015 Carsten Strunk
 *
 *   This Source Code Form is subject to the terms of the Mozilla Public
 *   License, v. 2.0. If a copy of the MPL was not distributed with this
 *   file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Hybrid Objecst Hardware Interface API
 * 
 * This API is intended for users who want to create their own hardware interfaces.
 * To create a new hardware interface create a folder under hardwareInterfaces and create the file index.js.
 * You should take a look at /hardwareInterfaces/emptyExample/index.js to get started.
 */

var http = require('http');
var utilities = require(__dirname + '/utilities');
var _ = require('lodash');

//global variables, passed through from server.js
var objects = {};
var objectLookup;
var globalVariables;
var dirnameO;
var nodeTypeModules;
var blockModules;
var callback;
var Node;
var actionCallback;
var writeObjectCallback;
var hardwareObjects = {};
var callBacks = new Objects();
var _this = this;
//data structures to manage the IO points generated by the API user
function Objects() {
    this.resetCallBacks = [];
    this.shutdownCallBacks = [];
}

function Object(objectName) {
    this.name = objectName;
    this.nodes = {};

}

function EmptyNode(nodeName, type) {
    this.name = nodeName;
    this.type = type;
    this.callBack = {};
}



function Frame() {
    // The ID for the object will be broadcasted along with the IP. It consists of the name with a 12 letter UUID added.
    this.objectId = null;
    // The name for the object used for interfaces.
    this.name = "";
    // Reality Editor: This is used to possition the UI element within its x axis in 3D Space. Relative to Marker origin.
    this.x = 0;
    // Reality Editor: This is used to possition the UI element within its y axis in 3D Space. Relative to Marker origin.
    this.y = 0;
    // Reality Editor: This is used to scale the UI element in 3D Space. Default scale is 1.
    this.scale = 1;
    // Unconstrained positioning in 3D space
    this.matrix = [];
    // Used internally from the reality editor to indicate if an object should be rendered or not.
    this.visible = false;
    // Used internally from the reality editor to trigger the visibility of naming UI elements.
    this.visibleText = false;
    // Used internally from the reality editor to indicate the editing status.
    this.visibleEditing = false;
    // Intended future use is to keep a memory of the last matrix transformation when interacted.
    // This data can be used for interacting with objects for when they are not visible.
    this.memory = {}; // TODO use this to store UI interface for image later.
    // Stores all the links that emerge from within the object. If a IOPoint has new data,
    // the server looks through the Links to find if the data has influence on other IOPoints or Objects.
    this.links = {};
    // Stores all IOPoints. These points are used to keep the state of an object and process its data.
    this.nodes = {};
    // local or global. If local, node-name is exposed to hardware interface
    this.location = "local";
    // source
    this.src = "editor";
}


/*
 ********** API FUNCTIONS *********
 */

/**
 * @desc This function writes the values passed from the hardware interface to the HybridObjects server.
 * @param {string} objectName The name of the HybridObject
 * @param {string} nodeName The name of the IO point
 * @param {value} value The value to be passed on
 * @param {string} mode specifies the datatype of value, you can define it to be whatever you want. For example 'f' could mean value is a floating point variable.
 **/
exports.write = function (objectName, frameName, nodeName, value, mode, unit, unitMin, unitMax) {

    if (typeof mode === 'undefined')  mode = "f";
    if (typeof unit === 'undefined')  unit = false;
    if (typeof unitMin === 'undefined')  unitMin = 0;
    if (typeof unitMax === 'undefined')  unitMax = 1;

    var objectKey = utilities.readObject(objectLookup, objectName); //get globally unique object id
    //  var valueKey = nodeName + objKey2;

    var nodeUuid = objectKey+frameName+nodeName;
    var frameUuid = objectKey+frameName;
    //console.log(objectLookup);
//    console.log("writeIOToServer obj: "+objectName + "  name: "+nodeName+ "  value: "+value+ "  mode: "+mode);
    if (objects.hasOwnProperty(objectKey)) {
        if (objects[objectKey].frames[frameUuid].nodes.hasOwnProperty(nodeUuid)) {
            var thisData = objects[objectKey].frames[frameUuid].nodes[nodeUuid].data;
            thisData.value = value;
            thisData.mode = mode;
            thisData.unit = unit;
            thisData.unitMin = unitMin;
            thisData.unitMax = unitMax;
            //callback is objectEngine in server.js. Notify data has changed.
            callback(objectKey, frameUuid, nodeUuid, thisData, objects, nodeTypeModules);
        }
    }
};

/**
 * @desc clearIO() removes IO points which are no longer needed. It should be called in your hardware interface after all addIO() calls have finished.
 * @param {string} type The name of your hardware interface (i.e. what you put in the type parameter of addIO())
 **/
exports.clearObject = function (objectId, frameID) {
    var objectID = utilities.getObjectIdFromTarget(objectId, dirnameO);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        for (var key in objects[objectID].frames[objectID].nodes) {
            if (!hardwareObjects[objectId].nodes.hasOwnProperty(key)) {
                cout("Deleting: " + objectID + "   "+ objectID + "   " + key);
                delete objects[objectID].frames[frameID].nodes[key];
            }
        }
    }
    //TODO: clear links too
    cout("object is all cleared");
};

exports.removeAllNodes = function (objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            console.log("object exists");
            for (var nodeKey in objects[objectID].nodes) {
                if (!objects[objectID].nodes.hasOwnProperty(nodeKey)) continue;
                    delete objects[objectID].nodes[nodeKey];
            }
        }
    }
};

exports.removeNode = function (objectName, nodeName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            var thisNode = objectID + nodeName;
            if (thisNode in objects[objectID].nodes) {
                console.log("deleting node " + thisNode);
                delete objects[objectID].nodes[thisNode];
            }
        }
    }
};

exports.reloadNodeUI = function (objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    actionCallback({reloadObject: {object: objectID}});
    writeObjectCallback(objectID);
};

exports.getAllNodes = function (objectName) {

    // get object ID
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);

    // lookup object properties using name
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            // get all of its nodes
            var nodes = objects[objectID].nodes;
            // return node list
            return nodes;
        }
    }

    return {};
};

exports.getAllLinksToNodes = function (objectName) {

    // get object ID
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);

    // lookup object properties using name
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            // get all of its nodes
            var links = objects[objectID].links;
            // return node list
            return links;
        }
    }

    return {};
};

/**
 * @desc addIO() a new IO point to the specified HybridObject
 * @param {string} objectName The name of the HybridObject
 *  * @param {string} frameName The name of the HybridObject frame
 * @param {string} nodeName The name of the nodeName
 * @param {string} type The name of the data conversion type. If you don't have your own put in "default".
 **/

exports.addNode = function (objectName, frameName, nodeName, type) {

    utilities.createFolder(objectName, frameName, dirnameO, globalVariables.debug);

    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    cout("AddIO objectID: " + objectID);

    var nodeUuid = objectID+frameName+nodeName;
    var frameUuid = objectID+frameName;

    //objID = nodeName + objectID;

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {

        cout("I will save: " + objectName + " and " + nodeName +"for frame "+ frameName);

        if (objects.hasOwnProperty(objectID)) {
            objects[objectID].developer = globalVariables.developer;
            objects[objectID].name = objectName;


            if (!objects[objectID].frames.hasOwnProperty(frameUuid)) {
                objects[objectID].frames[frameUuid] = new Frame();
            }
            if (!objects[objectID].frames[frameUuid].hasOwnProperty("nodes")) {
                objects[objectID].frames[frameUuid].nodes = {};
            }

            objects[objectID].frames[frameUuid].name = frameName;

            if (!objects[objectID].frames[frameUuid].nodes.hasOwnProperty(nodeUuid)) {
                var thisObject = objects[objectID].frames[frameUuid].nodes[nodeUuid] = new Node();
                thisObject.x = utilities.randomIntInc(0, 200) - 100;
                thisObject.y = utilities.randomIntInc(0, 200) - 100;
                thisObject.frameSizeX = 100;
                thisObject.frameSizeY = 100;
            }

            var thisObj = objects[objectID].frames[frameUuid].nodes[nodeUuid];
            thisObj.name = nodeName;
            thisObj.text = undefined;
            thisObj.type = type;

            if (!hardwareObjects.hasOwnProperty(objectName)) {
                hardwareObjects[objectName] = new Object(objectName);
            }

            if (!hardwareObjects.hasOwnProperty("frames")) {
                hardwareObjects[objectName].frames = {};
            }

            if (!hardwareObjects[objectName].frames.hasOwnProperty(frameUuid)) {
                hardwareObjects[objectName].frames[frameUuid] = {};
            }
            if (!hardwareObjects[objectName].frames[frameUuid].hasOwnProperty("nodes")) {
                hardwareObjects[objectName].frames[frameUuid].nodes = {};
            }

            if (!hardwareObjects[objectName].frames[frameUuid].nodes.hasOwnProperty(nodeUuid)) {
                hardwareObjects[objectName].frames[frameUuid].nodes[nodeUuid] = new EmptyNode(nodeName);
                hardwareObjects[objectName].frames[frameUuid].nodes[nodeUuid].type = type;
            }
        }
    }
    objectID = undefined;
};

exports.renameNode = function (objectName, frameName, oldNodeName, newNodeName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            var nodeUUID = objectID + frameName + oldNodeName;
            var frameUUID = objectID + frameName + oldNodeName;

            if(nodeUUID in objects[objectID].frames[frameUUID].nodes){
                objects[objectID].frames[frameUUID].nodes[nodeUUID].text = newNodeName;
               // return
            } /*else {
                for (var key in objects[objectID].nodes) {
                    if (objects[objectID].nodes[key].name === oldNodeName) {
                        objects[objectID].nodes[key].name = newNodeName;
                        return;
                    }
                }
            }*/
        }
    }
    actionCallback({reloadObject: {object: objectID, frame: frameUUID}});
    objectID = undefined;
};

exports.moveNode = function (objectName, nodeName, x, y) {
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            var thisNode = objectID + nodeName;
            if (thisNode in objects[objectID].nodes) {
                objects[objectID].nodes[thisNode].x = x;
                objects[objectID].nodes[thisNode].y = y;
                console.log("moved node " + nodeName + " to (" + x + ", " + y + ")");
            }
        }
    }
};

exports.activate = function (objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            objects[objectID].deactivated = false;
        }
    }
};

exports.deactivate = function (objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, dirnameO);
    console.log("--------- deactive---------")
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            objects[objectID].deactivated = true;

        }
    }
};




exports.getObjectIdFromObjectName = function (objectName) {
    return utilities.getObjectIdFromTarget(objectName, dirnameO);
};

/**
 * @desc developerOn() Enables the developer mode for all HybridObjects and enables the developer web interface
 **/
exports.enableDeveloperUI = function (developer) {
    globalVariables.developer = developer;
    for (var objectID in objects) {
        objects[objectID].developer = developer;
    }
};

/**
 * @desc getDebug() checks if debug mode is turned on
 * @return {boolean} true if debug mode is on, false otherwise
 **/
exports.getDebug = function () {
    return globalVariables.debug;
};

/*
 ********** END API FUNCTIONS *********
 */

/**
 * @desc setup() DO NOT call this in your hardware interface. setup() is only called from server.js to pass through some global variables.
 **/
exports.setup = function (objExp, objLookup, glblVars, dir, types, blocks, cb, objValue, actionCallBack, writeCallback) {
    objects = objExp;
    objectLookup = objLookup;
    globalVariables = glblVars;
    dirnameO = dir;
    nodeTypeModules = types;
    blockModules = blocks;
    callback = cb;
    Node = objValue;
    actionCallback = actionCallBack;
    writeObjectCallback = writeCallback;
};

exports.reset = function (){
    for (var objectKey in objects) {
        for (var frameKey in objects[objectKey].frames) {
            var frame = objects[objectKey].frames[frameKey];
            for (var nodeKey in frame.nodes) {
                var node = frame.nodes[nodeKey];
                if (node.type === "logic" || node.frame) {
                    continue;
                }
                // addNode requires that nodeKey === object.name + node.name
                _this.addNode(objects[objectKey].name, frame.name, node.name, node.type);
            }
            _this.clearObject(objectKey);
        }
    }

    cout("sendReset");
    for (var i = 0; i < callBacks.resetCallBacks.length; i++) {
        callBacks.resetCallBacks[i]();
    }
};

exports.readCall = function (objectName, frameName, nodeName, data) {
    if (callBacks.hasOwnProperty(objectName)) {
        if (callBacks[objectName].frames[frameName].nodes.hasOwnProperty(nodeName)) {
            callBacks[objectName].frames[frameName].nodes[nodeName].callBack(data);
        }
    }
};

exports.addReadListener = function (objectName, frameName, nodeName, callBack) {
    var objectID = utilities.readObject(objectLookup, objectName);
    var nodeID = objectID+frameName+nodeName;
    var frameID = objectID+frameName;

    cout("Add read listener for objectID: " + objectID);

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {

        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].frames.hasOwnProperty(frameID)) {
                if (!callBacks.hasOwnProperty(objectID)) {
                    callBacks[objectID] = new Object(objectID);
                }

                if (!callBacks[objectID].frames.hasOwnProperty(frameID)) {
                    callBacks[objectID].frames[frameID] = {};
                }

                if (!callBacks[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                    callBacks[objectID].frames[frameID].nodes[nodeID] = new EmptyNode(nodeName);
                    callBacks[objectID].frames[frameID].nodes[nodeID].callBack = callBack;
                } else {
                    callBacks[objectID].frames[frameID].nodes[nodeID].callBack = callBack;
                }
            }
        }
    }
};

exports.connectCall = function (objectName, frameName, nodeName, data) {
    if (callBacks.hasOwnProperty(objectName)) {
        if (callBacks[objectName].nodes.hasOwnProperty(nodeName)) {

            if (typeof callBacks[objectName].frames[frameName].nodes[nodeName].connectionCallBack == 'function') {
                callBacks[objectName].frames[frameName].nodes[nodeName].connectionCallBack(data);
                console.log("connection callback called");
            } else {
                console.log("no connection callback");
            }
        }
    }
};

exports.addConnectionListener = function (objectName, frameName, nodeName, callBack) {
    var objectID = utilities.readObject(objectLookup, objectName);
    var frameID = objectID + frameName;
    var nodeID = objectID + nodeName;

    cout("Add connection listener for objectID: " + objectID);

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {

        if (objects.hasOwnProperty(objectID)) {
            if (!callBacks.hasOwnProperty(objectID)) {
                callBacks[objectID] = new Object(objectID);
            }

            if (!callBacks[objectID].nodes.hasOwnProperty(nodeID)) {
                callBacks[objectID].nodes[nodeID] = new EmptyNode(nodeName);
                callBacks[objectID].nodes[nodeID].connectionCallBack = callBack;
            } else {
                callBacks[objectID].nodes[nodeID].connectionCallBack = callBack;
            }
        }
    }
};

exports.removeReadListeners = function (objectName, frameName){
    var objectID = utilities.readObject(objectLookup, objectName);
    var frameID = objectID + frameName;
    if(callBacks[objectID].frames[frameID])
    delete callBacks[objectID].frames[frameID];
};

exports.map = function (x, in_min, in_max, out_min, out_max) {
    if (x > in_max) x = in_max;
    if (x < in_min) x = in_min;
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};


exports.addEventListener = function (option, callBack){
    if(option === "reset") {
        cout("Add reset listener");
        callBacks.resetCallBacks.push(callBack);
    }
    if(option === "shutdown") {
        cout("Add reset listener");
        callBacks.shutdownCallBacks.push(callBack);
    }

};

exports.advertiseConnection = function (object, frame, node, logic){
    if(typeof logic === "undefined") {
        logic = false;
    }
    var objectID = utilities.readObject(objectLookup, object);
    var nodeID = objectID+frame+node;
    var frameID = objectID+frame;

    var message = {advertiseConnection:{
        object: objectID,
        frame: frameID,
        node: nodeID,
        logic: logic,
        names: [object, node],
    }};
    actionCallback(message);
};

exports.shutdown = function (){

    cout("call shutdowns");
    for (var i = 0; i < callBacks.shutdownCallBacks.length; i++) {
        callBacks.shutdownCallBacks[i]();
    }
};

function cout(msg) {
    if (globalVariables.debug) console.log(msg);
}