import {io} from './client.js';
import MouseState from './MouseState.js';
import App from './App.js';
import Users from './Users.js';

const baseUrl = 'localhost:9026/';
// const baseUrl = '52.148.200.159:3000';

const userId = '660297fd6d56d3307a8289a0';
const socket = io(`ws://${baseUrl}658941de12cd6a8a644d5066`, {
    auth: {
        name: 'team-lead 1',
        role: 'team-leads',
        userId: userId,
    }
});
const mouseState = new MouseState();
const app = new App(socket, userId, baseUrl);
const users = new Users();

socket.on('user.update', ([agent, agents, partnerFile]) => {
    users.update(agent.visitors);
    app.userUpdate(agent, agents, partnerFile);
});
mouseState.addMapping('search', (target) => {
    users.search(target.previousElementSibling.value);
});
socket.on('visitors.update', (visitor) => {
    users.updateUser(visitor);
});
socket.on('chats.view', function([chat, companionName, messages, visitorUnread, agentUnread, visitorCreated]){
    app.createtest(chat);
    app.chats[chat._id].recover(chat, companionName, messages, visitorUnread, agentUnread, visitorCreated);
});
mouseState.addMapping('view', (target) => {
    app.viewOpen(target);
});
mouseState.addMapping('visitors-load', (target) => {
    users.rollList(target.dataset.role, 'page');
});
socket.on('chats.views.list.update', function([chatId, oldUserId, user]){
    app.updatetest(chatId, oldUserId, user);
});
mouseState.addMapping('delete-view', (target) => {
    app.viewClose(target.parentElement.dataset.id);
});
socket.on('transfer.new.set', function(chat){
    app.transfersNewSet(chat);
});
socket.on('transfer.new.delete', function(chatId){
    app.transfersNewDelete(chatId);
});
mouseState.addMapping('chats-transfer-offer-agent', () => {
    app.transferOfferAgent();
});
mouseState.addMapping('chats-transfer-cancel', () => {
    app.transferCancel();
});
mouseState.addMapping('chats-transfer-offer-me', () => {
    app.transferOfferMe();
});
mouseState.addMapping('chats-transfer-offer', () => {
    app.chatsTransferOffer();
});
mouseState.addMapping('popup-close', () => {
    app.transferPopupClose();
});
mouseState.addMapping('open-banned-popup', () => {
    app.bannedOpen();
});
socket.on('permission.ban.set', function([date, userId, banReason]){
    app.setBan(date, userId, banReason);
});
socket.on('set.banned.users', (users) => {
    app.setBannedUsers(users)
});
mouseState.addMapping('un-ban-from-popup', (target) => {
    socket.emit('permission.ban', [target.parentElement.dataset.id]);
});
mouseState.addMapping('close-banned', () => {
    app.bannedUsersPopup.style.display = 'none';
});
socket.on('disconnect',() => {
    for (const i in app.chats) app.chats[i].connected = 0;

    //todo team-lead
    app.chatRequests.clear();
    app.transfers.clear();
    users.clear();
});

//todo agent
document.querySelector('#status-list').addEventListener('change', (e) => {
    socket.emit('agents.update.status', e.target.value);
});
mouseState.addMapping('logout', () => {
    socket.emit('logout');
});
mouseState.addMapping('internal', (target) => {
    socket.emit('chats.internal.set', target._id);
});
mouseState.addMapping('chats-get', () => {
    app.getChat();
});
socket.on('agents.update.status', ([userId, status, name]) => {
    app.agentsStatus(userId, status, name);
});
socket.on('chats.manual.set', chatId => {
    app.setChatRequest(chatId);
});
socket.on('chats.manual.delete', (chatId) => {
    app.deleteChatRequest(chatId);
});
socket.on('chats.recover', (args) => {
    app.create(args);
});
socket.on('chats.end', ([chatId, date]) => {
    app.endChat(chatId, date);
});
socket.on('chats.delete', (chatId) => {
    app.deleteChat(chatId);
});
socket.on('chats.status', ([name, userId, chatId, companionCreated]) => {
    app.chats[chatId].setStatus(name, userId, companionCreated);
});
socket.on('message.read', ([userId, chatId]) => {
    app.chats[chatId].setRead(userId);
});
socket.on('message.page', ([messages, ended, chatId]) => {
    app.chats[chatId].page(messages, ended);
});
socket.on('message.new', ([message, hasId, chatId]) => {
    app.new(message, hasId, chatId);
});
socket.on('message.new.log', ([chatId, message, userId, name]) => {
    app.newLog(chatId, message, userId, name);
});
socket.on('permission.file', ([status, chatId]) => {
    app.chats[chatId].messaging.setFile(status);
});

mouseState.buttonsListenTo(document.querySelector('#window'));