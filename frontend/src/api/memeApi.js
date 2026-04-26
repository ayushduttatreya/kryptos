import axios from 'axios';

export const fetchMemes = async (count = 50) => {
  try {
    const response = await axios.get(`https://meme-api.com/gimme/${count}`);
    return response.data.memes;
  } catch (error) {
    console.error('Failed to fetch memes', error);
    return [];
  }
};
