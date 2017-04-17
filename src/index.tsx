import React from 'react';
import {
    render
} from 'react-dom';
import {
    Provider,
    connect
} from 'react-redux';

import {
    createLoopStore
} from 'Loop/Loop';
import {
    Cmd
} from 'Platform/Cmd';
import {
    Msg,
    Model
} from 'App/Types';
import {
    initialModel,
    update
} from 'App/State';
import {
    View as AppView
} from 'App/View';

const store = createLoopStore<Model, Msg>(update, [ initialModel, Cmd.none()]);
const App = connect((model: Model) => ({ model }))(AppView);

render(
    (
        <Provider store={store}>
            <App />
        </Provider>
    ),
    document.getElementById('app')
);
