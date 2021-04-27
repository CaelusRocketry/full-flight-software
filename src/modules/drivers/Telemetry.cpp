#include <chrono>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/drivers/Telemetry.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/lib/Errors.hpp>
#include <flight/modules/lib/Util.hpp>
#include <thread>

using asio::ip::address;

Telemetry::Telemetry() {
    // Initialize variables
    connection = false;
    recv_buffer = "";
}

queue<string> Telemetry::read(int num_messages) {
    if (connection && !TERMINATE_FLAG) {
        try {
            // Read in data from socket
            if(socket.available() > 0) {
                std::array<char, 1024> buf;
                socket.read_some(asio::buffer(buf));
                string msg(buf.data());
                
                print("Telemetry: received: " + msg); //TODO: FIX THIS MSG CAN POTENTIALLY BE INCOMPLETE

                recv_buffer += msg;

                std::queue<string> q;

                size_t packet_start = recv_buffer.find('^');
                if(packet_start != string::npos) {
                    size_t packet_end = recv_buffer.find('$', packet_start);
                    if (packet_end != string::npos) {
                        // Strips the leading ^ and trailing $ off the packet string
                        string incoming_packet = recv_buffer.substr(packet_start + 1, packet_end - packet_start - 1);
                        printCritical("Telemetry: received full packet: " + incoming_packet);
                        q.push(incoming_packet);
                        recv_buffer = recv_buffer.substr(packet_end + 1);
                    }
                }
                return q;
            }
        }
        catch (std::exception& e){
            print(e.what());
            end();
            throw SOCKET_READ_ERROR();
        }
    }

    // type of list where elements are exclusively inserted from one side and removed from the other.
    std::queue<string> q;
    return q;
}

// This sends the packet to the GUI!
bool Telemetry::write() {

    // If there's nothing to send, return
    if(send_queue.size() == 0){
        return true;
    }

    string packet_string = send_queue.front();
    send_queue.pop();

    // Note: add "END" at the end of the packet, so packets are split correctly
    // string packet_string = output + "END";
    // print("Telemetry: Sending packet: " + packet_string);
    // print("");

    // Util::pause(1000);
    try {
        asio::write(socket, asio::buffer(packet_string), asio::transfer_all());
    }
    catch (std::exception& e) {
        print(e.what());
        throw SOCKET_WRITE_ERROR();
    }
    // print(Util::to_string(global_config.telemetry.DELAY));
    Util::pause(global_config.telemetry.DELAY);
    return true;
}

// This gets called in the main thread
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
//             Util::pause(global_config.telemetry.DELAY);
//         }
//         catch (std::exception& e){
//             print(e.what());
//             end();
//             throw SOCKET_READ_ERROR();
//         }
//     }
// }

bool Telemetry::get_status() const {
    return connection;
}

void Telemetry::reset() {
    end();
    if(!connect()){
        end();
    }
}

bool Telemetry::connect() {
    try {
        print("Telemetry: Connecting");
        socket.open(asio::ip::tcp::v4());

        address ip_address = address::from_string(global_config.telemetry.GS_IP);
        asio::ip::tcp::endpoint ep(ip_address, global_config.telemetry.GS_PORT);

        print("Telemetry: Connecting Socket");
        socket.connect(ep);

        print("Telemetry: Connected!");
    } catch(std::exception& e) {
        print(e.what());
        throw SOCKET_CONNECTION_ERROR();
    }

    socket.non_blocking(true);

    connection = true;
    TERMINATE_FLAG = false;

    // Util::pause(1000);

    // std::thread t([this] { this->recv_loop(); });
    // connection = true;
    // TERMINATE_FLAG = false;
    // recv_thread = &t;
    // recv_thread->detach();

    return true;
}

void Telemetry::end() {
    TERMINATE_FLAG = true;
    socket.close();
    connection = false;
}
