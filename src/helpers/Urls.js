import { ignoredUrls } from '../config/ignoredUrls.js';
import { URL } from 'url'; // Import the URL module

export const isUrlIgnored = (url) => {
    if (!url) return false;
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
    }
    try {
      const { hostname } = new URL(url);
      const hostnameLC = hostname.toLowerCase();
      return ignoredUrls.some(ignoredUrl => hostnameLC.includes(ignoredUrl.toLowerCase()));
    } catch (e) {
      console.error(`Invalid URL: ${url}`);
      return false;
    }
  };

  export const joinUrl = (base, path) => {
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  };