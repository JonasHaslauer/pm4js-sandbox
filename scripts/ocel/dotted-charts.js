class DottedChart {
    constructor(model) {
		this.data = {};

		// DEBUG, TODO REMOVE
		this.startTimestamps = {};
		this.endTimestamps = {};
		// END OF DEBUG

		this.model = model;

		this.types = {
			'Activity': Object.keys(this.model.overallEventsView.activities).sort(),
			'Object type': Object.keys(this.model.otObjectsView).sort()
		};

		this.data['Event'] = { 'Activity': this.createEventDataset() };
		this.data['Event per object'] = { 'Activity': this.createObjectLifecycleDataset('all', 'Activity'), 'Object type': this.createObjectLifecycleDataset('all', 'Object type')};
		this.data['Object creation'] = { 'Activity': this.createObjectLifecycleDataset('creation', 'Activity'), 'Object type': this.createObjectLifecycleDataset('creation', 'Object type')};
		this.data['Object destruction'] = { 'Activity': this.createObjectLifecycleDataset('destruction', 'Activity'), 'Object type': this.createObjectLifecycleDataset('destruction', 'Object type')};
		
		this.buildDottedChart();
	}

	startTime(name) {
		this.startTimestamps[name] = new Date();
	}

	endTime(name) {
		this.endTimestamps[name] = new Date();
		let elapsedTime = this.endTimestamps[name] - this.startTimestamps[name];
		console.log(`${name}: ${elapsedTime} ms | ${elapsedTime / 1000} s`);
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
				objectLifecycleData.push({
					'index': objectIndex,
					'timestamp': new Date(event[2] * 1000),
					'type': type == "Activity" ? event[1] : this.model.ocel['ocel:objects'][objectId]['ocel:type'],
					'info': objectId
				});
			}
		}
		
		return objectLifecycleData;
	}

	updateConfiguration() {
		this.x = document.getElementById('dottedChartSelectX').value;
		this.y = document.getElementById('dottedChartSelectY').value;
		this.dotSize = document.getElementById('dottedChartDotSize').value;

		this.type = document.getElementById('dottedChartSelectCategory').value;
		this.currentDataset = this.data[document.getElementById('dottedChartSelectDataset').value][this.type];

		
		this.allTypes = this.types[this.type];
	}

	buildDottedChart() {
		this.updateConfiguration();

		console.log(this);

		let dataX = this.createAxis(this.x);
		let dataY = this.createAxis(this.y);

		let dataText = {};
		for(let type of this.allTypes) {
			dataText[type] = [];
		}
		for(let x of this.currentDataset) {
			dataText[x.type].push(x.info);
		}

		let data = [];
		for(let type of this.allTypes) {
			data.push( {'x': dataX[type], 'y': dataY[type], 'text': dataText[type], 'type': 'scattergl', 'mode': 'markers', 'marker': { 'size': this.dotSize }, 'name': type} );
		}

		console.log(data);

		var layout = {
			title: `Dotted Chart - ${this.type}`,
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
	}

	createAxis(axisType) {
		let axisData = {};
		for(let type of this.allTypes) {
			axisData[type] = [];
		}		

		let data = this.currentDataset;
		console.log(data);
		switch(axisType) {
			case 'Timestamp':
				for(let x of data) {
					let timestamp = x.timestamp
					axisData[x.type].push(timestamp.getFullYear() + '-' + (timestamp.getMonth() + 1) + '-' + timestamp.getDate() + ' ' + timestamp.getHours() + ':' + timestamp.getMinutes() + ':' + timestamp.getSeconds());
				}
				break;
			case 'Index':
				for(let x of data) {
					axisData[x.type].push(x.index);
				}
				break;
			case 'Name':
				for(let x of data) {
					axisData[x.type].push(x.type);
				}
				break;
			case 'Day of week':
				for(let x of data) {
					axisData[x.type].push(x.timestamp.toLocaleDateString('en-EN', { weekday: 'long' }));
				}
				break;	
			case 'Time of day [m]':
				for(let x of data) {
					axisData[x.type].push(x.timestamp.getHours() * 60 + x.timestamp.getMinutes());
				}
				break;
			case 'Time of day [h]':
				for(let x of data) {
					axisData[x.type].push(x.timestamp.getHours() + x.timestamp.getMinutes() / 60);
				}
				break;	
		}

		return axisData;
	}

    buildDottedChartActivities() {
		let thisUuid = Pm4JS.startAlgorithm({"name": "OCPM buildDottedChartActivities"});

		setTimeout(() => {
			let objectsIds = this.model.overallObjectsView.objectsIdsSorted;
			let serie = [];
			for (let objId in objectsIds) {
				try {
					// objectsIdsSorted[objId] --> array of events containing the object
					// each event is array ['eventId', 'activity', timestamp (s)]
					let relEve = objectsIds[objId];
					// select timestamp of the first event the object is contained in
					let firstTimestamp = relEve[0][2];
					// add array containing objectId and timestamp of event where object appears first
					// serie.push({ 'objectId': objId, 'creationTimestamp': firstTimestamp })
					serie.push([objId, firstTimestamp]);
				}
				catch (err) {
				}
			}
			// sort objects by creation timestamp
			serie.sort((a, b) => a[1] - b[1]);

			// prepare object containing data for plot
			let dataPerActivity = {};
			let activities = Object.keys(this.model.overallEventsView.activities).sort();
			for(let activity of activities) {
				dataPerActivity[activity] = {x: [], y: [], type: "scattergl", mode: "markers", marker: { "size": 3 }, name: activity};
			}

			for (let objectIndex in serie) {
				// el = array containing objectId and timestamp of event where object appears first
				let el = serie[objectIndex];
				// get objectId
				let objId = el[0];
				// get all events where current object is included
				let relEve = objectsIds[objId];

				
				// iterate over events
				for (let eve of relEve) {
					let activity = eve[1];
					let timestamp = eve[2];
					let timestampDate = new Date(timestamp*1000);
					let timestampStru = timestampDate.getFullYear()  + "-" + (timestampDate.getMonth()+1) + "-" + timestampDate.getDate() + " " + timestampDate.getHours()+":"+timestampDate.getMinutes()+":"+timestampDate.getSeconds();
					dataPerActivity[activity].x.push(timestampStru);
					dataPerActivity[activity].y.push(objectIndex);
				}
					
			}
			
			var data = [];
			for (let activity of activities) {
				data.push(dataPerActivity[activity]);
			}
			console.log(data);
			var layout = {
				title: "Dotted Chart (color: activity)",
				xaxis: {
					title: "Timestamp",
					automargin: true
				},
				yaxis: {
					title: "Object index",
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
}