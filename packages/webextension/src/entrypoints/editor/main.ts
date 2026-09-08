import { mount } from 'svelte';
import { browserStorageAdapter, setStorageAdapter } from '@acme/shared/utils/storage';
import App from './App.svelte';
import './style.css';

setStorageAdapter(browserStorageAdapter);
mount(App, { target: document.getElementById('app')! });
