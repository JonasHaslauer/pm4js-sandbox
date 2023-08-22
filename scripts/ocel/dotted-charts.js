class DottedChart {
    constructor(model) {
		this.data = {};

		this.model = model;

		this.types = {
			'Activity': Object.keys(this.model.overallEventsView.activities).sort(),
			'Object type': Object.keys(this.model.otObjectsView).sort()
		};

		let eventDataset = this.createEventDataset();
		this.data['Event'] = { 'ordered': { 'Activity': eventDataset }, 'unordered': { 'Activity': eventDataset } };
		this.data['Event per object'] = {
			'ordered': {'Activity': this.createObjectLifecycleDataset('Event per object', 'Activity', true), 'Object type': this.createObjectLifecycleDataset('Event per object', 'Object type', true)},
			'unordered': { 'Activity': this.createObjectLifecycleDataset('Event per object', 'Activity', false), 'Object type': this.createObjectLifecycleDataset('Event per object', 'Object type', false)}
		};
		this.data['Object creation'] = { 
			'ordered': { 'Activity': this.createObjectLifecycleDataset('Object creation', 'Activity', true), 'Object type': this.createObjectLifecycleDataset('Object creation', 'Object type', true)},
			'unordered': { 'Activity': this.createObjectLifecycleDataset('Object creation', 'Activity', false), 'Object type': this.createObjectLifecycleDataset('Object creation', 'Object type', false)}
		};
		this.data['Object destruction'] = { 
			'ordered': { 'Activity': this.createObjectLifecycleDataset('Object destruction', 'Activity', true), 'Object type': this.createObjectLifecycleDataset('Object destruction', 'Object type', true)},
			'unordered': { 'Activity': this.createObjectLifecycleDataset('Object destruction', 'Activity', false), 'Object type': this.createObjectLifecycleDataset('Object destruction', 'Object type', false)}
		};

		this.data['Object lifecycle'] = {
			'ordered': { 
				'Activity': [...this.data['Object creation']['ordered']['Activity'], ...this.data['Object destruction']['ordered']['Activity']],
				'Object type': [...this.data['Object creation']['ordered']['Object type'], ...this.data['Object destruction']['ordered']['Object type']]
			},
			'unordered': { 
				'Activity': [...this.data['Object creation']['unordered']['Activity'], ...this.data['Object destruction']['unordered']['Activity']],
				'Object type': [...this.data['Object creation']['unordered']['Object type'], ...this.data['Object destruction']['unordered']['Object type']] 
			}
		};

		this.currentDataset = this.data['Event per object']['ordered']['Activity'];

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

	createObjectLifecycleDataset(eventsToInclude, type, ordered) {
		if(ordered) {
			return this.createOrderedObjectLifecycleDataset(eventsToInclude, type);
		}
		return this.createUnorderedObjectLifecycleDataset(eventsToInclude, type);
	}

	/*
	eventsToInclude = 'Event per object', 'Object creation', 'Object destruction'
	type = 'Activity', 'Object type'
	*/
	createOrderedObjectLifecycleDataset(eventsToInclude, type) {
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

		let preInfoText = eventsToInclude == 'Event per object' ? '' : eventsToInclude + ' of ';

		for (let objectIndex in objectCreation) {
			let objectId = objectCreation[objectIndex][0];
			let events = objectEventRelations[objectId];
			if(!events.length) {
				continue;
			}
			let eventsToAdd = [];
			switch(eventsToInclude) {
				case 'Event per object':
					eventsToAdd = events;
					break;
				case 'Object creation':
					eventsToAdd.push(events[0]);
					break;
				case 'Object destruction':
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

	/*
	eventsToInclude = 'Event per object', 'Object creation', 'Object destruction'
	type = 'Activity', 'Object type'
	*/
	createUnorderedObjectLifecycleDataset(eventsToInclude, type) {
		let objectLifecycleData = [];
		let objectEventRelations = this.model.overallObjectsView.objectsIdsSorted;

		let preInfoText = eventsToInclude == 'Event per object' ? '' : eventsToInclude + ' of ';

		let idx = 0;
		for(let objectIndex in this.model.ocel['ocel:objects']) {
			let events = objectEventRelations[objectIndex];
			if(!events.length) {
				continue;
			}
			let eventsToAdd = [];
			switch(eventsToInclude) {
				case 'Event per object':
					eventsToAdd = events;
					break;
				case 'Object creation':
					eventsToAdd.push(events[0]);
					break;
				case 'Object destruction':
					eventsToAdd.push(events.at(-1));
			}

			for(let event of eventsToAdd) {
				let objectType = this.model.ocel['ocel:objects'][objectIndex]['ocel:type'];
				objectLifecycleData.push({
					'index': idx,
					'timestamp': new Date(event[2] * 1000),
					'type': type == "Activity" ? event[1] : objectType,
					'info': `${preInfoText}${objectType} (${objectIndex}) - ${event[1]} (${event[0]})`
				});
			}
			idx++;
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
		this.objectOrder = document.getElementById('dottedChartOrderObjects').checked ? 'ordered' : 'unordered';
		this.currentDatasetName = document.getElementById('dottedChartSelectDataset').value;
		this.currentDataset = this.data[this.currentDatasetName][this.objectOrder][this.type];

		this.allTypes = this.types[this.type];

		this.randomSamplingValue = document.getElementById('dottedChartRandomSamplingValue').value / 100.0;
		if(previousRandomSamplingValue !== this.randomSamplingValue || previousDatasetLength !== this.currentDataset.length) {
			this.randomSampling = Array.from(this.currentDataset, () => Math.random() >= this.randomSamplingValue);
		}
	}

	buildDottedChart() {
		let thisUuid = Pm4JS.startAlgorithm({"name": "OCPM buildDottedChart"});

		console.log(this);

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