(function () {
    // Store the current timer for the scale
    var secondCount = 0;
    // also the timer but keeps it to hundred of a second
    var centisecondCount = 0;
    var isTimerActive = false;
    var timer;
    var scales = {}
    var activeScale = '';
    var graphData = [];
    var currentRun = ''

    // callback function passed to the scale library, handles all responses from scale
    function callback(id, type, value) {
        if (type === 'connected') {
            displayConnected(id);
        } else if (type === 'weight') {
            displayWeight(id, value);
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

    function displayConnected(scale) {
        var scaleList = document.getElementById('scale-list');
        scaleList.innerHTML = '';
        Object.keys(scales).forEach(function(id) {
            scaleList.insertAdjacentHTML('beforeend', `
                <div class="scale-element" id=${id}>
                    <div class="status-indicator status-indicator--conected"></div>
                    <div>
                        <div class="scale-name">${scales[id].name} - ${id.substring(0,5)}</div>
                        <div class="scale-status">Conected</div>
                    </div>
                </div>
            `);
        });
        scaleList.insertAdjacentHTML('beforeend', `
            <div class="scale-element active-scale" id=${scale.id}>
                <div class="status-indicator status-indicator--conected"></div>
                <div>
                    <div class="scale-name">${scale.name} - ${scale.id.substring(0,5)}</div>
                    <div class="scale-status">Conected</div>
                </div>  
            </div>
        `);
        /// <button class="delete-scale">X</button> 
        scales[scale.id] = {
            name: scale.name,
            isConnected: true,
            isActive: true,
            weightData: [],
        };
        activeScale = scale.id;
    }

    function displayWeight(id, value) {
        if (activeScale === id) {
            var weightDisplay = document.getElementById('weight');
            scales[id].currentWeight = value;
            weightDisplay.innerText = value;
        }; 
        if (isTimerActive) {
            scales[id].weightData[currentRun].push({
                time: centisecondCount / 100,
                weight: value,
            });
            scales[id].currentWeight = value;
        }
    }

    function handleStartTimer() {
        var timerDisplay = document.getElementById('timer');
        var flowRateDisplay = document.getElementById('flowrate');
        timerDisplay.innerText = formatSecondsToTime(secondCount);
        graphData = [];
        currentRun = Date.now();
        timer = setInterval(function () {
            secondCount += 1;
            timerDisplay.innerText = formatSecondsToTime(secondCount);
            flowRateDisplay.innerText =`${(scales[activeScale].currentWeight - scales[activeScale].lastWeight).toFixed(1)} g/s`;
            // -------------
            graphPoint = {
                time: secondCount,
            }
            Object.keys(scales).forEach(function(el) {
                graphPoint[`${scales[el].name}_weight`] = scales[el].currentWeight;
                graphPoint[`${scales[el].name}_flow`] = scales[el].currentWeight - scales[el].lastWeight;
                scales[el].lastWeight = scales[el].currentWeight
            })
            graphData.push(graphPoint);

        }, 1000)
        timerData = setInterval(function () {
            centisecondCount += 1;
        }, 10);
        graphPoint = {
            time: 0,
        }
        console.log('current scales', scales);
        Object.keys(scales).forEach(function(el) {
            scales[el].weightData[currentRun] = [];
            scales[el].weightData[currentRun].push({
                time: 0,
                weight: scales[el].currentWeight
            });
            graphPoint[`${scales[el].name}_weight`] = scales[el].currentWeight;
            graphPoint[`${scales[el].name}_flow`] = 0;
            scales[el].lastWeight = scales[el].currentWeight
        })
        graphData.push(graphPoint);
        isTimerActive = true;
        var modeDisplay = document.getElementById('mode-display')
        modeDisplay.innerText = `Mode: Timer Mode`;
    }

    function handleStopTimer() {
        var dataList = document.getElementById('data-list');
        clearInterval(timer);
        clearInterval(timerData);
        isTimerActive = false;
        if (dataList.className !== 'data-list') {
            dataList.className = 'data-list';
        }
        dataList.insertAdjacentHTML('beforeend', `
            <div class="list-element">
                <p>Dataset ${currentRun}</p>
                <button class="list-button" onClick="window.handleDownload(${currentRun})">Download CSV</button>
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

    function handleDownload(currentRun) {
        var downloadData = [];
        var dataSampleLengthArray = []
        Object.keys(scales).forEach(function (el) {
            dataSampleLengthArray.push(scales[el].weightData[currentRun].length)
        })
        var dataLenght = Math.max(dataSampleLengthArray);
        for (i=0; i<dataLenght; i++) {
            var dataPoint = {};
            Object.keys(scales).forEach(function (el) {
                dataPoint[`time_${scales[el].name}${el.substring(0,3)}`] = scales[el].weightData[currentRun][i].time;
                dataPoint[`weight_${scales[el].name}${el.substring(0,3)}`] = scales[el].weightData[currentRun][i].weight;
            });
            downloadData.push(dataPoint);
        };
        console.log(downloadData, graphData);
        exportToCSV(downloadData, currentRun);
    }

    window.handleDownload = handleDownload;
    window.onload = function() {
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
