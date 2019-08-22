(function () {
    var secondCount = 0;
    var centisecondCount = 0;
    var isTimerActive = false;
    var currentWeight = 0;
    var lastWeight = 0;
    var timer;
    var weightData = [];

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
        currentWeight = value;
        weightDisplay.innerText = value;
        if (isTimerActive) {
            weightData[weightData.length - 1].push({
                weight: value,
                time: centisecondCount / 100,
            });
            currentWeight = value;
        }
    }

    function handleStartTimer() {
        var timerDisplay = document.getElementById('timer');
        var flowRateDisplay = document.getElementById('flowrate');
        timerDisplay.innerText = formatSecondsToTime(secondCount);
        timer = setInterval(function () {
            secondCount += 1;
            timerDisplay.innerText = formatSecondsToTime(secondCount);
            flowRateDisplay.innerText =`${(currentWeight - lastWeight).toFixed(1)} g/s`;
            lastWeight = currentWeight;
        }, 1000)
        timerData = setInterval(function () {
            centisecondCount += 1;
        }, 10);
        weightData.push([{ weight: currentWeight, time: 0 }]);
        lastWeight = currentWeight;
        isTimerActive = true;
        var modeDisplay = document.getElementById('mode-display')
        modeDisplay.innerText = `Mode: Timer Mode`;
    }

    function handleStopTimer() {
        var dataList = document.getElementById('data-list');
        clearInterval(timer);
        clearInterval(timerData);
        isTimerActive = false;
        console.log(weightData);
        if (dataList.className !== 'data-list') {
            dataList.className = 'data-list';
        }
        dataList.insertAdjacentHTML('beforeend', `
            <div class="list-element">
                <p>Dataset ${weightData.length}</p>
                <button class="list-button" onClick="window.handleDownload(${weightData.length - 1})">Download CSV</button>
            </div>
        `)
    }

    function handleResetTimer() {
        var timerDisplay = document.getElementById('timer');
        secondCount = 0;
        centisecondCount = 0;
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

    function objectToCSVRow (dataObject) {
        var dataArray = new Array;
        for (var o in dataObject) {
            var innerValue = dataObject[o]===null?'':dataObject[o].toString();
            var result = innerValue.replace(/"/g, '""');
            result = result + ',';
            dataArray.push(result);
        }
        return dataArray.join(' ') + '\r\n';
    }

    function exportToCSV (arrayOfObjects, index) {

        if (!arrayOfObjects.length) {
            return;
        }
    
        var csvContent = "data:text/csv;charset=utf-8,";
    
        // headers
        csvContent += objectToCSVRow(Object.keys(arrayOfObjects[0]));
    
        arrayOfObjects.forEach(function(item){
            csvContent += objectToCSVRow(item);
        }); 
    
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `data${index}.csv`);
        document.body.appendChild(link); // Required for FF
        link.click();
        document.body.removeChild(link); 
    }

    function handleDownload(index) {
        exportToCSV(weightData[index], index);
    }

    window.handleDownload = handleDownload;
    window.onload=function(){
        document.getElementById("power").addEventListener("click", function(event){
            sendTimer();
        });
    
        document.getElementById("tare").addEventListener("click", function(event){
            sendTare();
        });
    
        document.getElementById("connect-button").addEventListener("click", function(event){
            discover();
        });
    }

})();
