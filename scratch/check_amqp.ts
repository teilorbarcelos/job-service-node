import amqp from 'amqplib';

async function test() {
  const conn = await amqp.connect('amqp://localhost');
  console.log(conn.constructor.name);
}
