import {Create} from "./Create.js";
import MouseState from "./MouseState.js";
import Chat from "./Chat.js";
import View from "./View.js";

export default class App{
    constructor(io, userId, baseUrl){
        this.io = io;
        this.userId = userId;
        this.messageFlag = 0;
        this.requestFlag = 0;
        this.chats = {};
        this.usersChats = {};
        this.partnerFile = 0;
        this.getChatId = '';
        this.chatRequests = new Set();
        this.statusList = document.querySelector('#status-list');
        this.agentsList = document.querySelector('#agents-list');
        this.requestsCount = document.querySelector('#chats_get');
        this.chatsWindow = document.querySelector('#chats');
        this.status = {2: 'grey', 3: 'brown', 4: 'green'};

        Create.setWidget(userId, baseUrl);

        //todo team-lead
        this.transfers = new Map();
        this.onlineAgents = new Map();
        this.viewsList = document.querySelector('#views-list');
        this.transfersCount = document.querySelector('#chats_transfer_offer');
        this.visitors = document.querySelector('#visitors');
        this.popup = document.querySelector('#popup');
        this.offersSelect = document.querySelector('#offers-select');
        this.bannedUsersPopup = document.querySelector('#banned-users-popup');
        this.transferOfferId = '';
    }


    updatetest(chatId, oldUserId, user){
        const viewRow = this.viewsList.querySelector(`[data-id="${chatId}"]`);
        if(!viewRow) return;

        const oldAgent = viewRow.parentElement;

        let viewList = this.viewsList.querySelector(`[data-id="${user._id}"]`);
        if(!viewList) viewList = Create.viewList(user);

        viewList.append(viewRow);

        this.viewsList.prepend(viewList);

        if(!oldAgent.querySelectorAll('div').length) oldAgent.remove();
    }

    createtest(chat){
        if(this.viewsList.querySelector(`[data-id="${chat._id}"]`)) return;

        let viewList = this.viewsList.querySelector(`[data-id="${chat.user._id}"]`);
        if(!viewList) viewList = Create.viewList(chat.user);

        viewList.append(Create.viewRow(chat._id, chat.companion.name, chat.companion._id));

        this.viewsList.prepend(viewList);
    }

    //chats
    userUpdate(agent, agents, partnerFile){
        this.partnerFile = partnerFile;

        for(const chat of Object.values(this.chats)){
            if(chat instanceof View){
                this.io.emit('chats.view', chat._id);
            }
        }

        this.statusList.querySelector(`option[value="${agent.status}"]`).selected = true;
        this.viewsList.innerHTML = '';
        agent.views.forEach(view => {
            this.createtest(view);
        });

        this.agentsList.innerHTML = '';
        agents.forEach(agent => {
            this.agentsStatus(agent._id, agent.status, agent.name);
            if(agent._id !== this.userId) this.onlineAgents.set(agent._id, agent);
        });

        agent.transfers.forEach(chat => this.transfers.set(chat.chatId, chat));
        this.updateTransfersCount();

        agent.requests.forEach(chatId => this.chatRequests.add(chatId));
        this.updateRequestsCount();
    }

    transferCancel(){
        this.io.emit('chats.transfer.offer', [this.transferOfferId]);
        this.transferPopupClose();
    }

    transferOfferAgent(){
        if(!this.offersSelect.value || !this.onlineAgents.has(this.offersSelect.value)) return;

        this.io.emit('chats.transfer.offer', [this.transferOfferId, this.offersSelect.value]);

        this.transferPopupClose();
    }

    transferOfferMe(){
        this.io.emit('chats.transfer.offer', [this.transferOfferId, this.userId]);
        this.transferPopupClose();
    }

    transferPopupClose(){
        this.popup.style.display = 'none';
        this.transferOfferId = '';
    }

    transfersNewDelete(chatId){
        if(chatId === this.transferOfferId) this.transferPopupClose();
        this.transfers.delete(chatId);
        this.updateTransfersCount();
    }

    transfersNewSet(chat){
        this.transfers.set(chat.chatId, chat);
        this.updateTransfersCount();
    }

    chatsTransferOffer(){
        if(this.transferOfferId || !this.transfers.size) return;
        const chat = this.transfers.values().next().value;
        this.transferOfferId = chat.chatId;

        this.offersSelect.innerHTML = '<option value="">--SELECT--</option>';
        this.onlineAgents.forEach(agent => {
            if(agent.status === 4) this.offersSelect.innerHTML += `<option value="${agent._id}">${agent.name}</option>`;
        });

        const agentNameElement = this.popup.querySelector('#names > p');

        agentNameElement.innerHTML = chat.agentName;
        agentNameElement.nextElementSibling.innerHTML = chat.visitorName;

        this.popup.style.display = 'block';
    }

    updateTransfersCount(){
        this.transfersCount.innerHTML = this.transfers.size ? this.transfers.size: '';
    }

    //view
    viewClose(viewId){
        const viewRow = this.viewsList.querySelector(`[data-id="${viewId}"]`);
        const agent = viewRow.parentElement;

        viewRow.remove();

        if(!agent.querySelectorAll('div').length) agent.remove();

        const chat = this.chats[viewId];
        if(chat && chat.view) this.deleteChat(viewId);

        this.io.emit('chats.view.end', viewId);
    }

    setBannedUsers(users){
        const body = this.bannedUsersPopup.querySelector('#banned-body');
        body.innerHTML = '';
        users.forEach(user => {
            body.append(Create.banedUserRow(user._id, user.name))
        });
    }

    setBan(date, userId, banReason){
        if(!date){
            const bannedRow = this.bannedUsersPopup.querySelector(`[data-id="${userId}"]`);
            if(bannedRow) bannedRow.remove();
        }

        document.querySelectorAll(`[data-user-id="${userId}"]`).forEach(viewRow => {
            if(this.chats[viewRow.dataset.id]) this.chats[viewRow.dataset.id].ban.set(!!date);
        });

        if(this.usersChats[userId]) this.chats[this.usersChats[userId]].ban.set(!!date);
    }

    bannedOpen(){ //todo http
        this.bannedUsersPopup.style.display = 'block';
        this.io.emit('get.banned.users');
    }

    viewOpen(viewRow){
        if(this.chats[viewRow._id]) return;

        this.chats[viewRow._id] = this.createView();
        this.io.emit('chats.view', viewRow._id);
    }

    createView(){
        const mouseState = new MouseState();
        const view = new View(this.io);

        mouseState.addMapping('scroll', () => {
            view.scroll();
        });
        mouseState.addMapping('open', () => {
            view.open();
        });
        mouseState.addMapping('chat-end', () => {
            this.viewClose(view._id);
        });
        mouseState.addMapping('ban-send', () => {
            view.banSend();
        });
        mouseState.addMapping('ban-open-button', () => {
            view.ban.open();
        });

        mouseState.buttonsListenTo(view.window);
        mouseState.scrollListenTo(view.messages);

        this.chatsWindow.append(view.window);

        return view;
    }

    createChat(chatId, companionUserId, status){
        const mouseState = new MouseState();
        const chat = new Chat(this.io, this.userId, status === 4, companionUserId, this.partnerFile);

        mouseState.addMapping('scroll', () => {
            chat.scroll();
        });
        mouseState.addMapping('message', () => {
            chat.message();
        });
        mouseState.addMapping('open', () => {
            if(chat.chatStatus === 0){chat.chatStatus = 1; this.io.emit('chats.get', chat._id);}
            chat.open();
        });
        mouseState.addMapping('permissions-file', () => {
            this.io.emit('permission.file', chat._id);
        });
        mouseState.addMapping('transfer', () => {
            chat.transferSet();
        });
        mouseState.addMapping('chat-end', () => {
            this.deleteChat(chat._id);
            chat.end();
        });

        //todo team-leads
        mouseState.addMapping('ban-send', () => {
            chat.banSend();
        });
        mouseState.addMapping('ban-open-button', () => {
            chat.ban.open();
        });

        mouseState.buttonsListenTo(chat.window);
        mouseState.scrollListenTo(chat.messages);

        this.chatsWindow.append(chat.window);

        return chat;
    }

    create(args){
        const [chat] = args;
        if(chat._id === this.getChatId){
            this.getChatId = '';
            this.chatRequests.delete(chat._id);
            this.updateRequestsCount();
        }

        if(!this.chats[chat._id]){
            if(this.chats[this.usersChats[chat.companion._id]]){
                this.chats[chat._id] = this.chats[this.usersChats[chat.companion._id]];
            }else{
                this.chats[chat._id] = this.createChat(chat._id, chat.companion._id, chat.status);
            }
        }else if(this.chats[chat._id].view){
            this.deleteChat(chat._id);
            this.chats[chat._id] = this.createChat(chat._id, chat.companion._id, chat.status);
        }


        this.usersChats[chat.companion._id] = chat._id;
        this.chats[chat._id].recover(...args);
    }

    agentsStatus(userId, status, name){
        if(userId !== this.userId){
            let agent = this.agentsList.querySelector(`[data-id="${userId}"]`);

            if(agent && status < 2){
                agent.remove();
                return this.onlineAgents.delete(userId)
            }

            if(!agent) agent = Create.agent(userId, name);

            this.onlineAgents.set(userId, {_id: userId, name: name, status: status});
            agent.querySelector(`span`).style.backgroundColor = this.status[status];

            this.agentsList.append(agent);
        }
    }

    //todo agent
    updateRequestsCount(){
        this.requestsCount.innerHTML = this.chatRequests.size ? this.chatRequests.size: '';
    }

    newLog(chatId, message, userId, name){
        if(!this.chats[chatId]) return;

        this.chats[chatId].setLogUser(userId, name);
        this.new(message, '', chatId);
    }

    new(message, hasId, chatId){
        if(this.chats[chatId].new(message, hasId) && document.hidden && this.messageFlag)
            new Notification('New message');
    }

    endChat(chatId, date){
        if(!this.chats[chatId] || this.chats[chatId].view) return;

        if(this.chats[chatId].internal) return this.deleteChat(chatId);

        this.chats[chatId].messaging.setFile(this.partnerFile === 2);

        this.chats[chatId].ending(date);
    }

    getChat(){
        if(this.getChatId) return;

        this.getChatId = this.chatRequests.keys().next().value;
        this.io.emit('chats.get', this.getChatId)
    }

    setChatRequest(chatId){
        this.chatRequests.add(chatId);
        this.updateRequestsCount();

        if(document.hidden && this.requestFlag) new Notification('New incoming');
    }

    deleteChatRequest(chatId){
        if(this.getChatId === chatId) this.getChatId = '';

        this.chatRequests.delete(chatId);
        this.updateRequestsCount();
    }

    deleteChat(chatId){
        if(this.chats[chatId].timeInterval) clearInterval(this.chats[chatId].timeInterval);
        this.chats[chatId].window.remove();

        delete this.usersChats[this.chats[chatId].companionUserId];
        delete this.chats[chatId];
    }
}