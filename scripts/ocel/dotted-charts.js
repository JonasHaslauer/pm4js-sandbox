class DottedChart {
    constructor(model) {
		this.data = {};

		this.model = model;

		this.types = {
			'Activity': Object.keys(this.model.overallEventsView.activities).sort(),
			'Object type': Object.keys(this.model.otObjectsView).sort()
		};

		this.data['Event'] = { 'Activity': this.createEventDataset() };
		this.data['Event per object'] = { 'Activity': this.createObjectLifecycleDataset('all', 'Activity'), 'Object type': this.createObjectLifecycleDataset('all', 'Object type')};
		this.data['Object creation'] = { 'Activity': this.createObjectLifecycleDataset('creation', 'Activity'), 'Object type': this.createObjectLifecycleDataset('creation', 'Object type')};
		this.data['Object destruction'] = { 'Activity': this.createObjectLifecycleDataset('destruction', 'Activity'), 'Object type': this.createObjectLifecycleDataset('destruction', 'Object type')};

		this.data['Object lifecycle'] = { 
			'Activity': [...this.data['Object creation']['Activity'], ...this.data['Object destruction']['Activity']],
			'Object type': [...this.data['Object creation']['Object type'], ...this.data['Object destruction']['Object type']] 
		};
		/*for(let i = 0; i < this.data['Object creation']['Activity'].length; i++) {
			this.data['Object lifecycle']['Activity'].push(this.data['Object creation']['Activity'][i]);
			this.data['Object lifecycle']['Activity'].push(this.data['Object destruction']['Activity'][i]);
			this.data['Object lifecycle']['Object type'].push(this.data['Object creation']['Object type'][i]);
			this.data['Object lifecycle']['Object type'].push(this.data['Object destruction']['Object type'][i]);
		}*/

		this.currentDataset = this.data['Event']['Activity'];

		this.randomSampling = Array.from(this.currentDataset.length, () => true);

		this.buildDottedChart();
	}

	createEventDataset() {
		let eventData = [];

		let events = this.model.ocel['ocel:events'];

		for(let eventId in events) {
			let event = events[eventId];
			
			let relatedObjects = event['ocel:omap'];
			let relatedObjectTypes = new Set();
			for(let relatedObject of relatedObjects) {
				relatedObjectTypes.add(this.model.ocel['ocel:objects'][relatedObject]['ocel:type'])
			}

			eventId = parseInt(eventId);
			eventData[eventId] = {
				'index': parseInt(eventId),
				'type': event['ocel:activity'],
				'timestamp': new Date(event['ocel:timestamp']),
				'info': `${eventId}: ${[...relatedObjectTypes].join(', ')} (${event['ocel:omap'].slice(0, 9).join(', ')}${event['ocel:omap'].length > 8 ? ', ...' : ''})`
			}
		}
		eventData = eventData.filter((x) => x !== undefined);
		
		return eventData;
	}

	/*
	eventsToInclude = 'all', 'creation', 'destruction'
	type = 'Activity', 'Object type'
	*/
	createObjectLifecycleDataset(eventsToInclude, type) {
		let objectLifecycleData = [];

		let objectEventRelations = this.model.overallObjectsView.objectsIdsSorted;

		// sort objectIds by their creation date, makes graphs look better/easier to read
		let objectCreation = [];
		for (let objectId in objectEventRelations) {
			let relatedEvents = objectEventRelations[objectId];
			if(!relatedEvents.length) continue;
			let firstTimestamp = relatedEvents[0][2];
			objectCreation.push([objectId, firstTimestamp]);
		}
		objectCreation.sort((a, b) => a[1] - b[1]);

		let preInfoText = eventsToInclude == 'all' ? '' : eventsToInclude + ' of ';

		for (let objectIndex in objectCreation) {
			let objectId = objectCreation[objectIndex][0];
			let events = objectEventRelations[objectId];
			if(!events.length) {
				continue;
			}
			let eventsToAdd = [];
			switch(eventsToInclude) {
				case 'all':
					eventsToAdd = events;
					break;
				case 'creation':
					eventsToAdd.push(events[0]);
					break;
				case 'destruction':
					eventsToAdd.push(events.at(-1));
			}

			for(let event of eventsToAdd) {
				let objectType = this.model.ocel['ocel:objects'][objectId]['ocel:type'];
				objectLifecycleData.push({
					'index': objectIndex,
					'timestamp': new Date(event[2] * 1000),
					'type': type == "Activity" ? event[1] : objectType,
					'info': `${preInfoText}${objectType} (${objectId}) - ${event[1]} (${event[0]})`
				});
			}
		}
		
		return objectLifecycleData;
	}

	updateConfiguration() {
		let previousRandomSamplingValue = this.randomSamplingValue;
		let previousDatasetLength = this.currentDataset.length;

		this.x = document.getElementById('dottedChartSelectX').value;
		this.y = document.getElementById('dottedChartSelectY').value;
		this.dotSize = document.getElementById('dottedChartDotSize').value;
		this.dotOpacity = document.getElementById('dottedChartDotOpacity').value / 100.0;

		this.type = document.getElementById('dottedChartSelectCategory').value;
		this.currentDatasetName = document.getElementById('dottedChartSelectDataset').value;
		this.currentDataset = this.data[this.currentDatasetName][this.type];

		this.allTypes = this.types[this.type];

		this.randomSamplingValue = document.getElementById('dottedChartRandomSamplingValue').value / 100.0;
		if(previousRandomSamplingValue !== this.randomSamplingValue || previousDatasetLength !== this.currentDataset.length) {
			this.randomSampling = Array.from(this.currentDataset, () => Math.random() >= this.randomSamplingValue);
		}
	}

	buildDottedChart() {
		let thisUuid = Pm4JS.startAlgorithm({"name": "OCPM buildDottedChart"});

		setTimeout(() => {
			this.updateConfiguration();
			let isLifecyclePlot = this.currentDatasetName == 'Object lifecycle';

			let dataX = this.createAxis(this.x);
			let dataY = this.createAxis(this.y);

			let symbol = 'circle';
			switch(this.currentDatasetName) {
				case 'Object destruction':
					symbol = 'cross';
					break;
				case 'Object lifecycle':
					symbol = {};
					break; 
			}

			let dataText = {};
			for(let type of this.allTypes) {
				dataText[type] = [];
				if(isLifecyclePlot) symbol[type] = [];
			}
			for(let x of this.currentDataset) {
				dataText[x.type].push(x.info);
				if(isLifecyclePlot) symbol[x.type].push(x.info.split(' ')[0] == 'creation' ? 'circle' : 'cross');
			}

			let data = [];
			for(let type of this.allTypes) {
				data.push({
					'x': dataX[type],
					'y': dataY[type],
					'text': dataText[type],
					'type': 'scattergl',
					'mode': 'markers',
					'marker': { 
						'size': this.dotSize,
						'symbol': isLifecyclePlot ? symbol[type] : symbol
					},
					'opacity': this.dotOpacity,
					'name': type
				});
			}

			var layout = {
				title: `Dotted Chart - ${this.currentDatasetName}`,
				xaxis: {
					title: this.x,
					automargin: true
				},
				yaxis: {
					title: this.y,
					automargin: true
				},
				font: {
					size: 19
				}
			};
			Plotly.newPlot('plotlyDottedChart', data, layout, {responsive: true});

			Pm4JS.stopAlgorithm(thisUuid, {});
		}, 100);
	}

	createAxis(axisType) {
		let axisData = {};
		for(let type of this.allTypes) {
			axisData[type] = [];
		}		

		let data = this.currentDataset;
		switch(axisType) {
			case 'Timestamp':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					let timestamp = x.timestamp
					if(this.randomSampling[i])
						axisData[x.type].push(timestamp.getFullYear() + '-' + (timestamp.getMonth() + 1) + '-' + timestamp.getDate() + ' ' + timestamp.getHours() + ':' + timestamp.getMinutes() + ':' + timestamp.getSeconds());
				}
				break;
			case 'Index':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x.type].push(x.index);
				}
				break;
			case 'Category':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x.type].push(x.type);
				}
				break;
			case 'Day of week':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x.type].push(x.timestamp.toLocaleDateString('en-EN', { weekday: 'long' }));
				}
				break;	
			case 'Time of day [m]':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x.type].push(x.timestamp.getHours() * 60 + x.timestamp.getMinutes());
				}
				break;
			case 'Time of day [h]':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x.type].push(x.timestamp.getHours() + x.timestamp.getMinutes() / 60);
				}
				break;	
		}

		return axisData;
	}
}