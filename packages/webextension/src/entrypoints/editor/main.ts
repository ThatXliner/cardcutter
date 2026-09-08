import { mount } from 'svelte';
import { browserStorageAdapter, setStorageAdapter } from '@acme/shared/utils/storage';
import App from './App.svelte';
import './style.css';

setStorageAdapter(browserStorageAdapter);

if (new URL(location.href).searchParams.get('popup') === '1') {
	document.body.classList.add('cardcutter-popup');
}

mount(App, { target: document.getElementById('app')! });
