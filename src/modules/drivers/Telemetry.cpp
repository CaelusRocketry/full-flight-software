#include <chrono>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/drivers/Telemetry.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/lib/Errors.hpp>
#include <flight/modules/lib/Util.hpp>
#include <thread>

// #include <iostream> //TODO: GETTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTRIGDDDDDDDDDDDDDDDDDDDDDDDDDD OF THISSSSSSSSSSSSSSSSSSSSS

using asio::ip::address;

Telemetry::Telemetry() {
    // Initialize variables
    connection = false;
}

queue<string> Telemetry::read(int num_messages) {
    if (connection && !TERMINATE_FLAG) {
        try {
            // Read in data from socket
            if(socket.available() > 0) {
                std::array<char, 1024> buf;
                socket.read_some(asio::buffer(buf));

                string msg(buf.data());
                
                print("Telemetry: Received: " + msg); //TODO: FIX THIS MSG CAN POTENTIALLY BE INCOMPLETE
                print("");

                vector<string> split_msg = Util::split(msg, string("END"));
                std::queue<string> q;

                for(string s : split_msg) {
                    q.push(s);
                    // print("Telemetry: split packet: " + s);
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

    string output = send_queue.front();
    send_queue.pop();
    
    // print("!!!!!!!!");

    // Note: add "END" at the end of the packet, so packets are split correctly
    string packet_string = output + "END";
    // print("Telemetry: Sending packet: " + packet_string);
    // print("");

    if(packet_string.find("sensor") != string::npos) {
        // print("\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n BIG OOGA BOOGA PAY ATTENTION ABOVE \n\n\n\n\n\n\n\n\n\n\n\n");
    }
    // Util::pause(1000);
    try {
        // print("dd");
        asio::write(socket, asio::buffer(packet_string), asio::transfer_all());
        // print(":)))");
    }
    catch (std::exception& e) {
        print(e.what());
        throw SOCKET_WRITE_ERROR();
    }
    // print("sssssssssd");
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
