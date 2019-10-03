(function () {
    // Store the current timer for the scale
    var secondCount = 0;
    var isTimerActive = false;
    var timer;
    var scales = {}
    var activeScale = '';
    var graphData = {
        time: [],
    };
    var graphDataExport = [];
    var currentRun = ''
    var chart;

    var colorArray = ['#FF6633', '#66E64D', '#FF33FF', '#FF6633', '#00B3E6', 
		  '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
		  '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A', 
		  '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
		  '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC', 
		  '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
		  '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680', 
		  '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
		  '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3', 
		  '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'];

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
                <div class="scale-element" id=${id} onclick="window.selectScale('${id}')">
                    <div class="status-indicator status-indicator--conected"></div>
                    <div>
                        <div class="scale-name">${scales[id].name} - ${id.substring(0,5)}</div>
                        <div class="scale-status">Conected</div>
                    </div>
                </div>
            `);
        });
        scaleList.insertAdjacentHTML('beforeend', `
            <div class="scale-element active-scale" id=${scale.id} onclick="window.selectScale('${scale.id}')">
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
                time: (Date.now() - currentRun) / 100,
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
            secondCount = Math.floor((Date.now() - currentRun) / 1000);
            timerDisplay.innerText = formatSecondsToTime(secondCount);
            flowRateDisplay.innerText =`${(scales[activeScale].currentWeight - scales[activeScale].lastWeight).toFixed(1)} g/s`;
            // -------------
            graphPoint = {
                time: secondCount,
            }
            graphData.time.push(secondCount),
            Object.keys(scales).forEach(function(el) {
                graphPoint[`${scales[el].name}_weight`] = scales[el].currentWeight;
                graphPoint[`${scales[el].name}_flow`] = (scales[el].currentWeight - scales[el].lastWeight).toFixed(1);
                graphData[`${scales[el].name}_weight`].push(scales[el].currentWeight);
                graphData[`${scales[el].name}_flow`].push((scales[el].currentWeight - scales[el].lastWeight).toFixed(1));
                scales[el].lastWeight = scales[el].currentWeight
            })
            graphDataExport.push(graphPoint);
            updateGraph(graphData);

        }, 1000)
        graphPoint = {
            time: 0,
        }
        graphData.time = [0];
        Object.keys(scales).forEach(function(el) {
            scales[el].weightData[currentRun] = [];
            scales[el].weightData[currentRun].push({
                time: 0,
                weight: scales[el].currentWeight
            });
            graphPoint[`${scales[el].name}_weight`] = scales[el].currentWeight;
            graphPoint[`${scales[el].name}_flow`] = 0;
            graphData[`${scales[el].name}_weight`] = [scales[el].currentWeight];
            graphData[`${scales[el].name}_flow`] = [(scales[el].currentWeight - scales[el].lastWeight).toFixed(1)];
            scales[el].lastWeight = scales[el].currentWeight
        })
        isTimerActive = true;
        var modeDisplay = document.getElementById('mode-display')
        modeDisplay.innerText = `Mode: Timer Mode`;
        initGraph();
    }

    function handleStopTimer() {
        if (timer) {
            var dataList = document.getElementById('data-list');
            clearInterval(timer);
            clearInterval(timerData);
            isTimerActive = false;
            showData();
            dataList.insertAdjacentHTML('beforeend', `
                <div class="list-element">
                    <p>Dataset ${currentRun}</p>
                    <button class="list-button" onClick="window.handleDownload(${currentRun})">Download CSV</button>
                </div>
            `)
        }
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
        var dataLenght = Math.max(...dataSampleLengthArray);
        for (i=0; i<dataLenght; i++) {
            var dataPoint = {};
            Object.keys(scales).forEach(function (el) {
                var point = scales[el].weightData[currentRun][i] || {}
                dataPoint[`time_${scales[el].name}${el.substring(0,3)}`] = point.time === undefined ? '' : point.time;
                dataPoint[`weight_${scales[el].name}${el.substring(0,3)}`] = point.weight === undefined ? '' : point.weight;
            });
            downloadData.push(dataPoint);
        };
        exportToCSV(downloadData, currentRun);
    }

    function selectScale(scaleId) {
        activeScale = scaleId;
        var scaleList = document.getElementById('scale-list');
        scaleList.innerHTML = '';
        Object.keys(scales).forEach(function(id) {
            scaleList.insertAdjacentHTML('beforeend', `
                <div class="scale-element ${id === scaleId ? 'active-scale' : ''}" id=${id} onclick="window.selectScale('${id}')">
                    <div class="status-indicator status-indicator--conected"></div>
                    <div>
                        <div class="scale-name">${scales[id].name} - ${id.substring(0,5)}</div>
                        <div class="scale-status">Conected</div>
                    </div>
                </div>
            `);
        });

    }

    function initGraph() {
        var graphDisplay = document.getElementById('graph-display');
        graphDisplay.setAttribute('style', 'display: flex')
        var ctx = document.getElementById('brew-chart').getContext('2d');
        var labels = graphData.time
        var datasets = [];
        Object.keys(graphData).forEach(function(data, index){
            if (data === 'time') return;
            datasets.push({
                label: data,
                backgroundColor: colorArray[index],
                borderColor: colorArray[index],
                borderDash: data.includes('flow') ? [ 5, 5 ] : undefined,
                steppedLine: data.includes('flow'),
                fill: false,
                data: graphData[data],
                yAxisID: data.includes('weight') ? 'weight':'flow',
            });
        });
        chart = new Chart(ctx, {
            // The type of chart we want to create
            type: 'line',

            // The data for our dataset
            data: {
                labels,
                datasets,
            },

            // Configuration options go here
            options: {
                scales: {
                    yAxes: [{
                        type: 'linear',
                        display: 'true',
                        position: 'left',
                        id: 'weight',
                        scaleLabel: {
                            labelString: 'Total weight (g)',
                            display: true,
                        },
                    },{
                        type: 'linear',
                        display: 'true',
                        position: 'right',
                        id: 'flow',
                        scaleLabel: {
                            labelString: 'Flow (g/s)',
                            display: true,
                        },
                        ticks: {
                            min: 0,
                            max: 16,
                        }
                    }],
                    xAxes: [{
                        autoSkip: true,
                        scaleLabel: {
                            labelString: 'Time (s)',
                            display: true,
                        },
                    }]
                }
            }
        });

    }

    function updateGraph(graphData) {
        /*
        chart.data.labels.push(graphData.time[graphData.time.length - 1]);
        chart.data.datasets.forEach(function(dataset) {
            dataset.data.push(graphData[dataset.label][graphData[dataset.label].length -1]);
        });
        */
        chart.update();
    }

    function closeGraph() {
        var graphDisplay = document.getElementById('graph-display');
        graphDisplay.setAttribute('style', 'display: none')
        chart.destroy()
    }

    function showScales() {
        var scalesButton = document.getElementById('scales-button');
        var dataButton = document.getElementById('data-button');
        var scaleList = document.getElementById('scale-list');
        var dataList = document.getElementById('data-list');
        dataButton.classList.remove('selected-button');
        scalesButton.classList.add('selected-button');
        scaleList.classList.remove('hide');
        dataList.classList.add('hide');
    }

    function showData() {
        var scalesButton = document.getElementById('scales-button');
        var dataButton = document.getElementById('data-button');
        var scaleList = document.getElementById('scale-list');
        var dataList = document.getElementById('data-list');
        scalesButton.classList.remove('selected-button');
        dataButton.classList.add('selected-button');
        scaleList.classList.add('hide');
        dataList.classList.remove('hide');
    }

    window.handleDownload = handleDownload;
    window.selectScale = selectScale;
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

        document.getElementById('scales-button').addEventListener('click', function(event) {
            showScales();
        });

        document.getElementById('data-button').addEventListener('click', function(event) {
            showData();
        });

        document.getElementById('close-button').addEventListener('click', function(event) {
            closeGraph();
        })
    }

})();
