import {
    Cmd
} from 'Platform/Cmd';
import {
    Msg,
    increment
} from './Types';

export const delayedIncrement = (delay: number) => Cmd.of(
    new Promise<Msg>((resolve) => {
        const timeoutID = setTimeout(() => {
            clearTimeout(timeoutID);

            resolve(
                increment()
            );
        }, delay);
    })
);