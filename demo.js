(function () {
    var secondCount = 0;
    var timer;

    function callback(type, value) {
        if (type === 'connected') {
            displayConnected();
        } else if (type === 'weight') {
            displayWeight(value);
        } else {
            switch(value) {
                case 'tare': 
                    console.log('it tare');
                    break;
                case 'timer_mode':
                    handleModeChange('Timer Mode');
                    break;
                case 'brew_mode':
                    handleModeChange('Brew Mode');
                    break;
                case 'weight_mode':
                    handleModeChange('Weight Mode');
                    break;
                case 'start_timer':
                    handleStartTimer();
                    break;
                case 'stop_timer':
                    handleStopTimer();
                    break;
                case 'reset_timer':
                    handleResetTimer();
                    break;
                default:
                    console.log('not know msg', value);
            }
        }
    }

    function displayConnected() {
        var connectButton = document.getElementById('connect-button');
        connectButton.innerText = 'Connected';
    }

    function displayWeight(value) {
        var weightDisplay = document.getElementById('weight');
        weightDisplay.innerText = value;
    }

    function handleStartTimer() {
        var timerDisplay = document.getElementById('timer');
        timerDisplay.innerText = formatSecondsToTime(secondCount);
        timer = setInterval(function () {
            secondCount += 1;
            timerDisplay.innerText = formatSecondsToTime(secondCount);
        }, 1000)
        var modeDisplay = document.getElementById('mode-display')
        modeDisplay.innerText = `Mode: Timer Mode`;
    }

    function handleStopTimer() {
        clearInterval(timer);
    }

    function handleResetTimer() {
        var timerDisplay = document.getElementById('timer');
        secondCount = 0;
        timerDisplay.innerText = formatSecondsToTime(secondCount);
    }

    function handleModeChange(mode) {
        var modeDisplay = document.getElementById('mode-display')
        modeDisplay.innerText = `Mode: ${mode}`;
        if (secondCount > 0) {
            handleStopTimer();
            handleResetTimer();
        }
    }

    function formatSecondsToTime(seconds) {
        var minutes = Math.floor(seconds/60);
        var seconds = seconds % 60;
        if (seconds < 10) {
            seconds = '0' + seconds;
        }
        return `${minutes}.${seconds}.`
    }

    var sf = new ScaleFinder(callback);
    function discover() {
        sf.startDiscovery();
    }
    function sendTare() {
        if (sf.tare) {
            sf.tare();
        } else {
            alert('Please connect scale first');
        }
    }

    function sendTimer() {
        if (sf.timer) {
            sf.timer();
        } else {
            alert('Please connect scale first');
        }
    }

    window.onload=function(){
        document.getElementById("power").addEventListener("click", function(event){
            event.preventDefault()
            sendTimer();
        });
    
        document.getElementById("tare").addEventListener("click", function(event){
            event.preventDefault()
            sendTare();
        });
    
        document.getElementById("connect-button").addEventListener("click", function(event){
            event.preventDefault()
            discover();
        });
    }

})();
