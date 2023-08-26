class DottedChart {
    constructor(model) {
		this.model = model;

		this.types = {
			'Activity': Object.keys(this.model.overallEventsView.activities).sort(),
			'Object type': Object.keys(this.model.otObjectsView).sort()
		};

		this.datasets = {
			"Event": null,
			"Event per object": null,
			"Object lifecycle": null,
			"Object creation": null,
			"Object destruction": null
		};

		this.currentDataset = [];

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
				'timestamp': new Date(event['ocel:timestamp']),
				'Activity': event['ocel:activity'],
				'Object type': event['ocel:activity'],
				'objectId': null,
				'info': `${eventId}: ${[...relatedObjectTypes].join(', ')} (${event['ocel:omap'].slice(0, 9).join(', ')}${event['ocel:omap'].length > 8 ? ', ...' : ''})`,
				'symbol': 'circle'
			}
		}
		eventData = eventData.filter((x) => x !== undefined);
		
		return eventData;
	}

	// eventsToInclude = 'Event per object', 'Object creation', 'Object destruction'
	createObjectLifecycleDataset(eventsToInclude) {
		let objectLifecycleData = [];
		let symbolToUse = eventsToInclude == 'Object destruction' ? 'cross' : 'circle';

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
			let objectType = this.model.ocel['ocel:objects'][objectId]['ocel:type'];
			let events = objectEventRelations[objectId];

			if(!events.length) continue;

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
				objectLifecycleData.push({
					'index': objectIndex,
					'timestamp': new Date(event[2] * 1000),
					'Activity': event[1],
					'Object type': objectType,
					'objectId': objectId,
					'info': `${preInfoText}${objectType} (${objectId}) - ${event[1]} (${event[0]})`,
					'symbol': symbolToUse
				});
			}
		}
		
		return objectLifecycleData;
	}

	updateConfiguration() {
		let previousRandomSamplingValue = this.randomSamplingValue;
		let previousDatasetName = this.currentDatasetName;

		// possible values: "Timestamp", "Index", "Category", "Day of week", "Time of day [m]", "Time of day [h]"
		this.x = document.getElementById('dottedChartSelectX').value;
		this.y = document.getElementById('dottedChartSelectY').value;

		this.dotSize = document.getElementById('dottedChartDotSize').value;
		this.dotOpacity = document.getElementById('dottedChartDotOpacity').value / 100.0;

		// possible values: "Activity", "Object type"
		this.type = document.getElementById('dottedChartSelectCategory').value;

		// possible values: "Event", "Event per object", "Object lifecycle", "Object creation", "Object destruction"
		this.currentDatasetName = document.getElementById('dottedChartSelectDataset').value;

		// possible values: "Creation time", "Creation time + object type"
		let sortObjectsBy = document.getElementById('dottedChartSelectOrderSorting').value; 

		// if dataset was not created yet, create it
		if(!this.datasets[this.currentDatasetName]) {
			if(this.currentDatasetName == 'Event') this.datasets[this.currentDatasetName] = this.createEventDataset();
			else if(this.currentDatasetName == 'Object lifecycle') this.datasets[this.currentDatasetName] = [...this.createObjectLifecycleDataset('Object creation'), ...this.createObjectLifecycleDataset('Object destruction')]
			else this.datasets[this.currentDatasetName] = this.createObjectLifecycleDataset(this.currentDatasetName)
		}

		// change dataset to use and sort it if necessary
		if(this.currentDatasetName == 'Event') this.currentDataset = this.datasets[this.currentDatasetName]; // do not sort event dataset
		switch(sortObjectsBy) {
			case 'Creation time + object type':
				// create deep copy of dataset and sort it by object type, creation time sorting is preserved
				this.currentDataset = structuredClone(this.datasets[this.currentDatasetName]).sort( (a, b) =>  a['Object type'].localeCompare(b['Object type']) );
				let objectIdIndexMapping = {};
				let newIndex = 0;
				for(let x of this.currentDataset) {
					if(!objectIdIndexMapping[x.objectId]) objectIdIndexMapping[x.objectId] = newIndex++;
					x.index = objectIdIndexMapping[x.objectId];
				}
				break;
			default:
				this.currentDataset = this.datasets[this.currentDatasetName];
				break;
		}
		
		this.allTypes = this.types[this.type];

		this.randomSamplingValue = document.getElementById('dottedChartRandomSamplingValue').value / 100.0;
		if(previousRandomSamplingValue !== this.randomSamplingValue || previousDatasetName !== this.currentDatasetName) {
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

			let symbol = {};
			let dataText = {};
			for(let type of this.allTypes) {
				dataText[type] = [];
				symbol[type] = [];
			}

			for(let i = 0; i < this.currentDataset.length; i++) {
				if(this.randomSampling[i]) {
					let x = this.currentDataset[i];
					dataText[x[this.type]].push(x.info);
					symbol[x[this.type]].push(x.symbol);
				}
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
						'symbol': symbol[type]
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
			Plotly.newPlot('plotlyDottedChart', data, layout, { modeBarButtonsToRemove: ['select2d', 'lasso2d'] });

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
					if(this.randomSampling[i]) axisData[x[this.type]].push(x.timestamp);
				}
				break;
			case 'Index':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x[this.type]].push(x.index);
				}
				break;
			case 'Category':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x[this.type]].push(x[this.type]);
				}
				break;
			case 'Day of week':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x[this.type]].push(x.timestamp.toLocaleDateString('en-EN', { weekday: 'long' }));
				}
				break;	
			case 'Time of day [m]':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x[this.type]].push(x.timestamp.getHours() * 60 + x.timestamp.getMinutes());
				}
				break;
			case 'Time of day [h]':
				for(let i = 0; i < data.length; i++) {
					let x = data[i];
					if(this.randomSampling[i]) axisData[x[this.type]].push(x.timestamp.getHours() + x.timestamp.getMinutes() / 60);
				}
				break;	
		}

		return axisData;
	}
}