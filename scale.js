// based on https://github.com/bpowers/btscale
let SCALE_SERVICE_UUID = '00001820-0000-1000-8000-00805f9b34fb';
let SCALE_CHARACTERISTIC_UUID = '00002a80-0000-1000-8000-00805f9b34fb';

let SCALE_SERVICE_UUID_V2 = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
let SCALE_CHARACTERISTIC_UUID_V2_TX = '49535343-1e4d-4bd9-ba61-23c647249616';
let SCALE_CHARACTERISTIC_UUID_V2_RX = '49535343-8841-43f4-a8d4-ecbe34729bb3';

let HEADER1 = 0xef;
let HEADER2 = 0xdd;


var Queue = (function () {

    Queue.prototype.running = false;
    Queue.prototype.queue = [];
    Queue.prototype.callback = null;

    function Queue(callback) {

        this.queue = [];
        this.callback = callback;
    };

    Queue.prototype.add = function (data) {

        var _this = this;

        this.queue.push(data);

        if (!this.running) {
            this.dequeue();
        }
    };

    Queue.prototype.dequeue = function () {

        this.running = true;

        while (val = this.queue.shift()) {
            this.callback(val);
        }

        this.running = false;
    };

    Queue.prototype.next = Queue.prototype.dequeue;

    return Queue;

})();


var Message = (function () {

    function Message(type, payload) {

        this.type = type;
        this.payload = payload;
        this.value = null;

        if (type === 5) {
            var value = ((payload[1] & 0xff) << 8) + (payload[0] & 0xff);
            var unit = payload[4] & 0xFF;

            if (unit === 1) {
                value /= 10;
            }
            else if (unit === 2) {
                value /= 100;
            }
            else if (unit === 3) {
                value /= 1000;
            }
            else if (unit === 4) {
                value /= 10000;
            }

            if ((payload[5] & 0x02) === 0x02) {
                value *= -1;
            }

            this.value = value;
        } else if (type === 8) {
            this.value = payload[0];

        }
    }

    return Message;
}());


function encode(msgType, payload) {

    var buf = new ArrayBuffer(5 + payload.length);
    var bytes = new Uint8Array(buf);
    bytes[0] = HEADER1;
    bytes[1] = HEADER2;
    bytes[2] = msgType;
    var cksum1 = 0;
    var cksum2 = 0;

    for (var i = 0; i < payload.length; i++) {
        var val = payload[i] & 0xff;
        bytes[3 + i] = val;
        if (i % 2 == 0) {
            cksum1 += val;
        }
        else {
            cksum2 += val;
        }
    }

    bytes[payload.length + 3] = (cksum1 & 0xFF);
    bytes[payload.length + 4] = (cksum2 & 0xFF);

    return buf;
}


function decode(bytes) {

    if (bytes[0] !== HEADER1 && bytes[1] !== HEADER2) {
        return;
    }

    var cmd = bytes[2];

    // only supports event notification messages
    if (cmd != 12) {

        //non event notification message
        //scale.js:127 Uint8Array(14) [239, 221, 8, 9, 83, 2, 2, 1, 0, 1, 1, 1, 14, 86]
        // 8 -> status
        // 9 -> length
        // 83 -> battery (83%)
        console.log('non event notification message');
        console.log(bytes);
        return;
    }

    // TODO: verify length + checksum

    var msgType = bytes[4];
    var payloadIn = new Uint8Array(bytes.slice(5));

    return new Message(msgType, payloadIn);
}


function encodeEventData(payload) {

    var buf = new ArrayBuffer(payload.length + 1);
    var bytes = new Uint8Array(buf);
    bytes[0] = payload.length + 1;

    for (var i = 0; i < payload.length; i++) {
        bytes[i + 1] = payload[i] & 0xff;
    }

    return encode(12, bytes);
}


function encodeNotificationRequest() {

    var payload = [
        0,  // weight
        1,  // weight argument
        1,  // battery
        2,  // battery argument
        2,  // timer
        5,  // timer argument
        3,  // key
        4   // setting
    ];

    return encodeEventData(payload);
}


function encodeId() {

    var payload = [0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d];
    return encode(11, payload);
}


function encodeHeartbeat() {

    var payload = [2, 0];
    return encode(0, payload);
}



function encodeTare() {

    var payload = [0];
    return encode(4, payload);
}

function encodeTimer(value) {
    var payload = [0, value];
    return encode(13, payload);
}


var Scale = (function () {

    function Scale(device, customCallback) {

        this.connected = false;
        this.service = null;
        this.characteristicReceive = null;
        this.characteristicSend = null;
        this.weight = null;
        this.device = device;
        this.name = this.device.name;
        this.queue = null;
        this.timerStatus = 0;
        this.customCallback = customCallback;
        console.log('created scale for ' + this.device.id + ' (' + this.device.name + ')');
        this.connect();
    }

    Scale.prototype.connect = function () {

        var _this = this;
        if (this.connected) {
            return;
        }

        var log = console.log.bind(console);

        _this.queue = new Queue(function (payload) {

            _this.addBuffer(payload);
            // the packet header is split from the content
            // need to read in two times and recompose the message
            if (_this.packet.byteLength <= 3) {
                return;
            }

            // TODO: read length and make sure we have enough data
            // before decoding message

            var msg = decode(_this.packet);
            _this.packet = null;

            if (!msg) {
                console.log('characteristic value update, but no message');
                return;
            }
            
            if (msg.type === 5) {
                console.log('Received weight:', msg.value)
                _this.weight = msg.value;
                _this.customCallback ? _this.customCallback(_this.device.id, 'weight', msg.value) : console.log('weight', msg.value);
            } else if (msg.type === 11) {
            } else if (msg.type === 8) {
                console.log('Received msg:', msg)
                var action;
                switch (msg.value) {
                    case 0:
                        action = 'tare';
                        break;
                    case 4:
                        action = 'timer_mode';
                        break;
                    case 3:
                        action = 'brew_mode';
                        break;
                    case 2:
                        action = 'weight_mode';
                        break;
                    case 8:
                        action = 'start_timer';
                        _this.timerStatus = 2;
                        break;
                    case 10:
                        action = 'stop_timer';
                        _this.timerStatus = 1;
                        break;
                    case 9:
                        action = 'reset_timer';
                        _this.timerStatus = 0;
                        break;
                    default:
                        action = 'default';
                        break;

                }
                _this.customCallback ? _this.customCallback(_this.device.id, 'action', action) : console.log('action', action);
            } else {
                console.log('non-weight response');
                console.log(msg);
            }
        });

        this.device.gatt.connect()
            .then(function (server) {
                console.log('Connected to scale server', server)
                return _this.device.gatt.getPrimaryServices();
            }, function (err) {
                console.log('error connecting - ' + err);
                return null;
            })
            .then(function (services) {
                console.log('primary services ', services);
                _this.service = services.find(e => e.uuid === SCALE_SERVICE_UUID_V2 || e.uuid == SCALE_SERVICE_UUID);
                console.log('selected primary service ', _this.service);

                return _this.service.getCharacteristic(_this.service.uuid === SCALE_SERVICE_UUID_V2 ? SCALE_CHARACTERISTIC_UUID_V2_RX : SCALE_CHARACTERISTIC_UUID);
            }, function (err) {
                console.log('primary services ERR - ' + err);
                return null;
            })
            .then(function (characteristicSend) {
                _this.characteristicSend = characteristicSend;
                console.log('Setting send characteristic ', characteristicSend);
                return _this.service.getCharacteristic(_this.service.uuid === SCALE_SERVICE_UUID_V2 ? SCALE_CHARACTERISTIC_UUID_V2_TX : SCALE_CHARACTERISTIC_UUID);
            }, function (err) {
                console.log('err getting send characteristic', err);
                return null;
            })
            .then(function (characteristicReceive) {
                log('Starting receive characteristic...', characteristicReceive);
                _this.characteristicReceive = characteristicReceive;
                return characteristicReceive.startNotifications();
            }, function (err) {
                console.log('err getting receive characteristic', err);
                return null;
            })
            .then(function (characteristicReceive) {
                log('Adding event listener');
                characteristicReceive.addEventListener('characteristicvaluechanged', _this.characteristicValueChanged.bind(_this));
                _this.notificationsReady();
            }, function (err) {
                log('FAILED: ' + err);
                return null;
            });
    };


    Scale.prototype.addBuffer = function (buffer2) {

        var tmp = new Uint8Array(buffer2);
        var len = 0;

        if (this.packet != null) {
            len = this.packet.length;
        }

        var result = new Uint8Array(len + buffer2.byteLength);

        for (var i = 0; i < len; i++) {
            result[i] = this.packet[i];
        }

        for (var i = 0; i < buffer2.byteLength; i++) {
            result[i + len] = tmp[i];
        }

        this.packet = result;
    }


    Scale.prototype.characteristicValueChanged = function (event) {

        this.queue.add(event.target.value.buffer);
    };

    Scale.prototype.disconnect = function () {

        this.connected = false;
        if (this.device) {
            this.device.gatt.connect();
        }
    };

    Scale.prototype.notificationsReady = function () {

        console.log('scale ready');
        this.connected = true;
        this.ident();
        this.customCallback(this.device, 'connected');
        setInterval(this.heartbeat.bind(this), 5000);
    };

    Scale.prototype.ident = function () {

        if (!this.connected) {
            return false;
        }

        var _this = this;
        this.characteristicSend.writeValue(encodeId())
            .then(function () {
            }, function (err) {
                console.log('write ident failed: ' + err);
            }).then(function () {
                _this.characteristicSend.writeValue(encodeNotificationRequest())
                    .then(function () {
                    }, function (err) {
                        console.log('write failed: ' + err);
                    });
            });

        return true;
    };

    Scale.prototype.heartbeat = function () {

        if (!this.connected) {
            return false;
        }

        this.characteristicSend.writeValue(encodeHeartbeat())
            .then(function () {
            }, function (err) {
                console.log('write heartbeat failed: ' + err);
            });

        return true;
    };

    Scale.prototype.tare = function () {
        if (!this.connected) {
            return false;
        }
        this.characteristicSend.writeValue(encodeTare())
            .then(function () {
            }, function (err) {
                console.log('write tare failed: ' + err);
            });

        return true;
    };

    Scale.prototype.timer = function () {
        var _this = this;
        if (!this.connected) {
            return false;
        }
        this.characteristicSend.writeValue(encodeTimer(_this.timerStatus))
            .then(function () {
                var value;
                console.log('Timer Status', _this.timerStatus)
                switch (_this.timerStatus) {
                    case 0:
                        value = 'start_timer';
                        _this.timerStatus = 2;
                        break;
                    case 1:
                        value = 'reset_timer';
                        _this.timerStatus = 0;
                        break;
                    case 2:
                        value = 'stop_timer';
                        _this.timerStatus = 1;
                        break;
                    default:
                        value = 'reset_timer';
                        _this.timerStatus = 0;
                }
                _this.customCallback('action', value);
            }, function (err) {
                console.log('write timer failed: ' + err);
            });

        return true;
    };

    return Scale;
}());


var bluetooth = navigator.bluetooth;
var ScaleFinder = (function () {

    function ScaleFinder(customCallback = undefined) {
        this.ready = false;
        this.devices = {};
        this.scales = [];
        this.failed = false;
        this.customCallback = customCallback;
        console.log('new ScaleFinder');
    }

    ScaleFinder.prototype.deviceAdded = function (device) {

        if (device.id in this.devices) {
            console.log('WARN: device added that is already known ' + device.id);
            return;
        }
        var scale = new Scale(device, this.customCallback);
        this.devices[device.id] = scale;
        this.tare = scale.tare.bind(scale);
        this.timer = scale.timer.bind(scale);
        this.scales.push(scale);
    };

    ScaleFinder.prototype.startDiscovery = function () {

        var _this = this;
        if (this.failed) {
            return;
        }
        bluetooth.requestDevice({
            filters: [
                {
                    services: [SCALE_SERVICE_UUID]
                },
                {
                    manufacturerData: [{ companyIdentifier: 0x4242 }]
                }],
            optionalServices: [
                SCALE_SERVICE_UUID, 
                SCALE_SERVICE_UUID_V2]
        })
            .then(function (device) {
                console.log('Selected Device', device)
                _this.deviceAdded(device);
            });
    };

    ScaleFinder.prototype.stopDiscovery = function () {

        if (this.failed) {
            return;
        }
    };

    return ScaleFinder;
}());

if (typeof window !== 'undefined') {
    window.ScaleFinder = ScaleFinder;
}
