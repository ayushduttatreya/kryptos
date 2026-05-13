import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Assuming backend serves on same host or proxied
});

export const getIdentity = async () => {
  try {
    const res = await api.get('/identity');
    return res.data;
  } catch (error) {
    console.error('getIdentity failed', error);
    return null;
  }
};

export const getContacts = async () => {
  try {
    const res = await api.get('/contacts');
    return res.data;
  } catch (error) {
    console.error('getContacts failed', error);
    return [];
  }
};

export const sendMessage = async (contactId, text, priority = false) => {
  try {
    const res = await api.post('/messages', { contactId, text, priority });
    return res.data;
  } catch (error) {
    console.error('sendMessage failed', error);
    return null;
  }
};

export const getMessages = async (contactId) => {
  try {
    const res = await api.get(`/messages/${contactId}`);
    return res.data;
  } catch (error) {
    console.error('getMessages failed', error);
    return [];
  }
};

export const getChannelsStatus = async () => {
  try {
    const res = await api.get('/channels/status');
    return res.data;
  } catch (error) {
    console.error('getChannelsStatus failed', error);
    return null;
  }
};

export const createContact = async (contact) => {
  try {
    const res = await api.post('/contacts', contact);
    return res.data;
  } catch (error) {
    console.error('createContact failed', error);
    return null;
  }
};

export const deleteContact = async (contactId) => {
  try {
    const res = await api.delete(`/contacts/${contactId}`);
    return res.data;
  } catch (error) {
    console.error('deleteContact failed', error);
    return null;
  }
};

export const getStats = async (contactId) => {
  try {
    const res = await api.get(`/stats/${contactId}`);
    return res.data;
  } catch (error) {
    console.error('getStats failed', error);
    return null;
  }
};

export const startPoll = async (contactId) => {
  try {
    const res = await api.post('/poll/start', { contactId });
    return res.data;
  } catch (error) {
    console.error('startPoll failed', error);
    return null;
  }
};

export const stopPoll = async (contactId) => {
  try {
    const res = await api.post('/poll/stop', { contactId });
    return res.data;
  } catch (error) {
    console.error('stopPoll failed', error);
    return null;
  }
};
