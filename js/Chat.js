import {Create} from './Create.js';
import Messaging from "./Messaging.js";
import Ban from "./Ban.js";

export default class Chat{
    constructor(io, userId, internal, companionUserId, partnerFile){
        this.internal = internal;
        this._id = '';
        this.io = io;
        this.userId = userId;
        this.notSent = [];
        this.awaitScroll = false;
        this.logUsers = {};
        this.visible = false;
        this.unreadCount = 0;
        this.chatStatus = 1;
        this.connected = 0;
        this.timeInterval = null;
        this.companionUserId = companionUserId;

        this.widgetName = Create.widgetName();
        this.window = Create.window();
        this.body = Create.body();
        this.header = Create.header();
        this.unread = Create.unread();
        this.status = document.createElement('div');
        this.endButton = Create.endButton();
        this.statusLoader = Create.statusLoader();
        this.messageLoader = Create.loader();
        this.messages = Create.messages();
        this.messaging = new Messaging(userId, companionUserId, partnerFile === 2, this.logUsers);
        this.ban = new Ban();

        this.footer = document.createElement('div');
        this.transfer = Create.transfer();
        this.controller = Create.controller();
        this.time = Create.time();

        this.controller.append(this.transfer, this.time);
        if(partnerFile === 1){
            this.permissionsFile = Create.permissionsFile();
            this.controller.append(this.permissionsFile)
        }
        this.controller.append(this.ban.window);
        this.status.append(this.statusLoader);
        this.footer.append(this.messaging.window, this.controller);
        this.body.append(this.messages);
        this.header.append(this.unread, this.status, this.widgetName, this.endButton);
        this.window.append(this.header);

        //todo team-lead
        // this.ban
    }

    recover(chat, companionName,  [messages], companionUnread, unreadCount, companionCreated){
        if(chat.status === 0 && this.visible) this.header.click();

        for(const [key, value] of Object.entries(chat.logUsers)) this.logUsers[key] = value;

        this.widgetName.innerText = chat.widgetName;
        this._id = chat._id;
        this.connected = 1;
        this.chatStatus = chat.status;
        this.messageLoader.remove();
        this.messaging.setFile(chat.file === 2);
        this.body.append(this.footer);
        this.setStatus(companionName, '', companionCreated);
        this.setUnread(unreadCount);
        this.ban.set(chat.companion.banExpire);

        companionUnread.forEach(messageId => this.messaging.companionUnread.add(messageId));

        for(let i=0; i < messages.length; i+=5){
            const messageElement = this.messages.querySelector(`#i${messages[i]}`);
            if(messageElement) continue;

            this.messages.append(this.messaging.create(messages.slice(i, i+5)));
        }

        if(this.notSent.length){
            while(true){
                const message = this.notSent.shift();
                if(!message) break;

                this.io.emit('message.set', [this._id, message]);

                this.messages.append(this.messages.querySelector(`#i${message[0]}`));
            }
        }
    }

    banSend(){
        this.io.emit('permission.ban', [this.companionUserId, this.ban.dates.value, 'test ban reason']);
    }

    //todo agent
    transferSet(){
        this.io.emit('chats.transfer.set', [this._id]);
    }

    setLogUser(userId, name){
        if(!name) return;
        this.logUsers[userId] = name;
    }

    updateTime(){
        const min = this.companionCreated ? Math.round((Date.now() - this.companionCreated)/1000/60): 0;
        this.time.innerText = min + ' min.';
    }

    timeRun(companionCreated){
        this.companionCreated = companionCreated;

        this.updateTime();
        clearInterval(this.timeInterval);

        if(this.companionCreated){
            this.timeInterval = setInterval(() => {
                this.updateTime();
                if(!this.companionCreated) clearInterval(this.timeInterval);
            }, 60*1000);
        }
    }

    setStatus(name, userId, companionCreated){
        if(userId === this.userId) return;

        if(!isNaN(companionCreated)) this.timeRun(companionCreated);

        if(name){
            this.statusLoader.remove();
            return this.status.innerText = name;
        }

        this.status.innerHTML = '';
        this.status.append(this.statusLoader);
    }

    setRead(userId){
        if(this.userId === userId) return;

        this.messages.querySelectorAll('.unread').forEach(message => {
            message.classList.remove('unread');
        });

        this.messaging.companionUnread.clear();
    }

    page(messages, ended){
        this.messageLoader.remove();

        if(ended) this.messages.dataset.name = '';

        for(let i = messages.length-5; i >= 0; i-=5)
            this.messages.prepend(this.messaging.create(messages.slice(i, i+5)));

        this.awaitScroll = ended;
    }

    end(){
        this.io.emit('chats.end', [this._id, this.companionUserId]);
    }

    ending(){
        this.footer.remove();
        this.messages.querySelectorAll('.message').forEach(message => message.id = '');
    }

    new(message, hashId){
        const messageElement = this.messages.querySelector(`#i${hashId}`);
        if(messageElement) return messageElement.id = `i${message[0]}`;

        this.messages.append(Create.message(message, false, false, this.logUsers));

        this.setUnread(++this.unreadCount);
    }

    scroll(){
        if(this.awaitScroll) return;

        const firstMessage = this.messages.querySelector('.message');
        if(firstMessage && firstMessage.id) {
            const messagesTop = this.messages.getBoundingClientRect()['top'] - 200;
            const firstMessageTop = firstMessage.getBoundingClientRect()['top'];

            if(firstMessageTop > messagesTop){
                this.messages.prepend(this.messageLoader);
                this.io.emit('message.page', [this._id, firstMessage.id]);
            }
        }
    }

    message(){
        if(!this.messaging.has()) return;
        const hashId = Math.random().toString(32).slice(2);
        const message = this.messaging.get();

        this.messages.append(
            Create.message([hashId, message[0], message[1], message[2][1], Date.now()], true, true, this.logUsers)
        );

        if(this.connected === 1)
            return this.io.emit('message.set', [this._id, [hashId, [message[1], message[2]]]]);

        this.notSent.push([hashId, [message[1], message[2]]]);
    }

    open(){
        this.visible = !this.visible;

        if(this.visible){
            this.setUnread(this.unreadCount);
            this.window.append(this.body);
            this.unread.remove();
        }else{
            this.body.remove();
            this.header.prepend(this.unread);
        }
    }

    setUnread(unreadCount){
        if(this.visible && unreadCount){
            this.io.emit('message.read', this._id);
            unreadCount = 0;
        }

        this.unreadCount = unreadCount;
        if(!unreadCount)
            return this.unread.style.display = 'none';

        this.unread.style.display = 'block';
        this.unread.innerText = unreadCount ? unreadCount: '';
    }
}