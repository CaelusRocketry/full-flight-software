#ifndef DESKTOP
    #include <flight/modules/lib/logger_util.hpp>
    #include <flight/modules/drivers/XBee.hpp>
    #include <flight/modules/mcl/Config.hpp>
    #include <flight/modules/lib/Errors.hpp>
    #include <flight/modules/lib/Util.hpp>
    #include <flight/modules/lib/Log.hpp>

    XBee::XBee() {
        // Initialize variables
        xbee = &Serial3;
        xbee->begin(9600);
        connection = true;
    }

    queue<string> XBee::read(int num_messages) {
        // print("XBee: Current buffer: " + rcvd);

        // printCritical("------------------------");
        read_buffer();
        if (num_messages > (int) ingest_queue.size() || num_messages == -1){
            num_messages = (int) ingest_queue.size();
        }

        // type of list where elements are exclusively inserted from one side and removed from the other.
        queue<string> q;
        for (int i = 0; i < num_messages; i++){
            q.push(ingest_queue.front());
            ingest_queue.pop();
        }

        return q;
    }

    // Send the next subpacket in queue
    bool XBee::write() {
        // If the queue is empty, do nothing
        if(send_queue.size() == 0){
            print("THERES NOTHING IN THE SEND QUEUE");
            return true;
        }
        else{
            print("THERES SMTH IN THE SEND QUEUE");
        }

        int DELAY_SEND = 50;
        string to_send = send_queue.front();
        send_queue.pop();
        while (!(send_queue.empty())) {
            to_send += send_queue.front();
            send_queue.pop();
        }
        printCritical("CURRENT LENGTH OF SEND QUEUE::::: " + Util::to_string(static_cast<int>(send_queue.size())));
        try {
            char const *c = to_send.c_str();
            printEssential("\nSENDING PACKET: " + to_send + "\n");
            xbee->begin(9600); // 05/01/2021 NEED TO KEEP THIS LINE HERE DO NOT MOVE
            xbee->write(c);
        }
        catch (std::exception& e) {
            printCritical(e.what());
            printCritical("ERROR IN XBEE WRITE!");
            throw XBEE_WRITE_ERROR();
        }
        Util::pause(DELAY_SEND);
        return true;
    }

    void XBee::read_buffer() {
        while (this->connection && !TERMINATE_FLAG && xbee->available()) {
            try {
                // Read in data from socket
                // const char* msg(xbee->read());
                // string msg_str(msg);
                char msg = xbee->read();
                string msg_str(1, msg);
                rcvd.append(msg_str);
                // printEssential("XBee: Recieved: " + msg_str);
            }
            catch (std::exception& e){
                print(e.what());
                end();
                throw XBEE_READ_ERROR();
            }
        }

        size_t packet_start = rcvd.find('^');
        // while(true){
        //     rcvd = rcvd.substr(packet_start + 1);
        //     if(rcvd.find("^") != string::npos){
        //         break;
        //     }
        //     packet_start = rcvd.find('^');
        // }
        // string incoming_packet = rcvd.substr(packet_start + 1, packet_end - packet_start - 1);
        if(packet_start != string::npos) {
            size_t packet_end = rcvd.find('$', packet_start);
            if (packet_end != string::npos) {
                string incoming_packet = rcvd.substr(packet_start + 1, packet_end - packet_start - 1);
                printCritical("XBee: Received Full Packet: " + incoming_packet);
                int idx = Util::getMaxIndex(incoming_packet, "|");
                string jason = incoming_packet.substr(0, idx);
                string checksum = Log::generateChecksum(jason);
                string sentChecksum = incoming_packet.substr(idx + 1);
                printEssential("Calculated checksum: " + checksum);
                printEssential("Got checksum: " + sentChecksum);
                if(checksum == sentChecksum){
                    printEssential("Got a valid string: " + incoming_packet);
                    ingest_queue.push(incoming_packet);
                }

                rcvd = rcvd.substr(packet_end + 1);
            }
        }

        // print("xbee: received: " + rcvd);
    }

    bool XBee::get_status() const {
        return connection;
    }

    void XBee::reset() {
        end();
        bool res = connect();
        if (!res) {
            end();
        }
    }

    bool XBee::connect() {
        print("XBee: connecting.");

        // try {
        //     xbee->begin(global_config.telemetry.XBEE_BAUD_RATE);
        // } catch(std::exception& e) {
        //     print(e.what());
        //     throw XBEE_CONNECTION_ERROR();
        // }

        connection = true;
        TERMINATE_FLAG = false;

        return true;
    }

    void XBee::end() {
        TERMINATE_FLAG = true;
        connection = false;
    }

#endif
