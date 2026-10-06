const { Kafka, logLevel } = require('kafkajs');

class KafkaService {
    constructor(brokers = [process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092']) {
        this.kafka = new Kafka({
            clientId: 'multi-db-app',
            brokers: brokers,
            logLevel: process.env.NODE_ENV === 'production' ? logLevel.ERROR : logLevel.INFO,
            retry: {
                initialRetryTime: 300,
                retries: 10
            }
        });

        this.producer = this.kafka.producer({
            allowAutoTopicCreation: true,
            retry: {
                initialRetryTime: 300,
                retries: 5
            }
        });

        this.consumer = this.kafka.consumer({
            groupId: 'database-changes-group',
            retry: {
                initialRetryTime: 300,
                retries: 10
            }
        });

        this.isProducerConnected = false;
        this.isConsumerConnected = false;
        this.topicName = 'database-changes';
        this.dlqTopicName = 'database-changes-dlq'; // Dead Letter Queue topic
    }

    async connectProducer() {
        if (!this.isProducerConnected) {
            try {
                await this.producer.connect();
                this.isProducerConnected = true;
                console.log('Kafka producer connected');
            } catch (error) {
                console.error('Failed to connect Kafka producer:', error);
                throw error; // Re-throw to allow caller to handle
            }
        }
    }

    async ensureTopicExists() {
        const admin = this.kafka.admin();
        try {
            await admin.connect();
            const topics = await admin.listTopics();

            if (!topics.includes(this.topicName)) {
                await admin.createTopics({
                    topics: [{ topic: this.topicName, numPartitions: 1, replicationFactor: 1 }],
                    waitForLeaders: true
                });
                console.log(`Created topic: ${this.topicName}`);
            }
        } finally {
            await admin.disconnect();
        }
    }

    async connectConsumer() {
        if (!this.isConsumerConnected) {
            try {
                // Make sure topic exists before connecting consumer
                await this.ensureTopicExists();

                await this.consumer.connect();
                await this.consumer.subscribe({
                    topic: this.topicName,
                    fromBeginning: false
                });
                this.isConsumerConnected = true;
                console.log(`Kafka consumer connected and subscribed to ${this.topicName} topic`);
            } catch (error) {
                console.error('Failed to connect Kafka consumer:', error);
                throw error;
            }
        }
    }

    async disconnect() {
        try {
            if (this.isProducerConnected) {
                await this.producer.disconnect();
                this.isProducerConnected = false;
                console.log('Kafka producer disconnected');
            }

            if (this.isConsumerConnected) {
                await this.consumer.disconnect();
                this.isConsumerConnected = false;
                console.log('Kafka consumer disconnected');
            }
        } catch (error) {
            console.error('Error disconnecting from Kafka:', error);
            throw error;
        }
    }

    async publishDatabaseChange(database, operation, data, table) {
        try {
            if (!this.isProducerConnected) {
                await this.connectProducer();
            }

            const message = {
                database: database, // 'postgresql', 'mongodb', or 'neo4j'
                operation: operation, // 'INSERT', 'UPDATE', 'DELETE', 'QUERY'
                timestamp: new Date().toISOString(),
                data: data
            };

            const key = `${database}-${table || 'query'}-${Date.now()}`;

            await this.producer.send({
                topic: this.topicName,
                messages: [
                    {
                        key,
                        value: JSON.stringify(message),
                        headers: {
                            'source': database,
                            'operation': operation,
                            'timestamp': new Date().toISOString()
                        }
                    }
                ]
            });

            console.log(`Published ${operation} event from ${database} to ${table || 'unknown'}`);
            return true;
        } catch (error) {
            console.error('Error publishing to Kafka:', error);
            return false;
        }
    }

    async startConsumer(handlers = {}) {
        if (!this.isConsumerConnected) {
            await this.connectConsumer();
        }

        await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const changeEvent = JSON.parse(message.value.toString());
                    console.log(`Processing ${changeEvent.operation} event from ${changeEvent.database}`);

                    // Call appropriate handler based on database source
                    const handler = handlers[changeEvent.database];
                    if (handler && typeof handler === 'function') {
                        await handler(changeEvent);
                    } else {
                        console.log(`No handler for ${changeEvent.database} events`);
                    }
                } catch (error) {
                    console.error('Error processing Kafka message:', error);

                    // Send to Dead Letter Queue if processing fails
                    try {
                        if (message && message.value) {
                            await this.sendToDLQ(message);
                        }
                    } catch (dlqError) {
                        console.error('Failed to send to DLQ:', dlqError);
                    }
                }
            },
        });

        console.log('Kafka consumer started');
    }

    // New method: Send failed messages to Dead Letter Queue
    async sendToDLQ(message) {
        if (!this.isProducerConnected) {
            await this.connectProducer();
        }

        await this.producer.send({
            topic: this.dlqTopicName,
            messages: [{
                key: message.key,
                value: message.value,
                headers: {
                    ...message.headers,
                    'error_time': new Date().toISOString(),
                    'original_topic': this.topicName
                }
            }]
        });

        console.log('Message sent to Dead Letter Queue');
    }
}

module.exports = KafkaService;