import { apiClient } from "./client.js";

export const fetchArticles = (offset = 0) =>
  apiClient.get(`/articles?limit=20&offset=${offset}`);

export const fetchArticle = (id) =>
  apiClient.get(`/articles/${id}`);

export const fetchLibrary = () =>
  apiClient.get("/articles/library/mine");

export const publishArticle = (article) =>
  apiClient.post("/articles", article);
