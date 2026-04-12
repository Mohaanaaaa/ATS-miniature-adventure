import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:5000/api";

export const startTrek = (data) => axios.post(`${API_BASE_URL}/start_trek`, data);
export const getActiveTrekkers = () => axios.get(`${API_BASE_URL}/active_trekkers`);