// #include <chrono>
// #include <flight/modules/lib/logger_util.hpp>
// #include <flight/modules/drivers/Telemetry.hpp>
// #include <flight/modules/mcl/Config.hpp>
// #include <flight/modules/lib/Errors.hpp>

// using asio::ip::address;

// Telemetry::Telemetry() {
//     // Initialize variables
//     connection = false;
// }

// queue<string> Telemetry::read(int num_messages) {
//     mtx.lock(); // prevents anything else from a different thread from accessing the ingest_queue until we're done
//     if (num_messages > ingest_queue.size() || num_messages == -1){
//         num_messages = ingest_queue.size();
//     }

//     // type of list where elements are exclusively inserted from one side and removed from the other.
//     queue<string> q;
//     for (int i = 0; i < num_messages; i++){
//         q.push(ingest_queue.front());
//         ingest_queue.pop();
//     }

//     mtx.unlock();
//     return q;
// }

// // This sends the packet to the GUI!
// bool Telemetry::write(const Packet& packet) {
//     // Convert to JSON and then to a string
//     json packet_json;
//     to_json(packet_json, packet);

//     // Note: add "END" at the end of the packet, so packets are split correctly
//     string packet_string = packet_json.dump() + "END";
//     print("Telemetry: Sending packet: " + packet_string);

//     try {
//         asio::write(socket, asio::buffer(packet_string), asio::transfer_all());
//     }
//     catch (std::exception& e) {
//         print(e.what());
//         throw SOCKET_WRITE_ERROR();
//     }

//     this_thread::sleep_for(chrono::milliseconds(global_config.telemetry.DELAY));
//     return true;
// }

// // This gets called in the main thread
// void Telemetry::recv_loop() {
//     while (connection && !TERMINATE_FLAG) {
//         try {
//             // Read in data from socket
//             std::array<char, 1024> buf;
//             socket.read_some(asio::buffer(buf));

//             string msg(buf.data());

//             mtx.lock();
//             ingest_queue.push(msg);
//             mtx.unlock();

//             print("Telemetry: Received: " + msg);
//             this_thread::sleep_for(chrono::seconds(global_config.telemetry.DELAY));
//         }
//         catch (std::exception& e){
//             print(e.what());
//             end();
//             throw SOCKET_READ_ERROR();
//         }
//     }
// }

// bool Telemetry::get_status() const {
//     return connection;
// }

// void Telemetry::reset() {
//     end();
//     if(!connect()){
//         end();
//     }
// }

// bool Telemetry::connect() {
//     try {
//         print("Telemetry: Connecting");
//         socket.open(asio::ip::tcp::v4());

//         address ip_address = address::from_string(global_config.telemetry.GS_IP);
//         asio::ip::tcp::endpoint ep(ip_address, global_config.telemetry.GS_PORT);

//         print("Telemetry: Connecting Socket");
//         socket.connect(ep);

//         print("Telemetry: Connected!");
//     } catch(std::exception& e) {
//         print(e.what());
//         throw SOCKET_CONNECTION_ERROR();
//     }

//     thread t(&Telemetry::recv_loop, this);
//     connection = true;
//     TERMINATE_FLAG = false;
//     recv_thread = &t;
//     recv_thread->detach();

//     return true;
// }

// void Telemetry::end() {
//     TERMINATE_FLAG = true;
//     socket.close();
//     connection = false;
// }
