import * as React from 'react';
import styled from 'styled-components';

import {
    Maybe,
    Nothing,
    Just
} from 'Fractal/Maybe';
import {
    Dispatch
} from 'Fractal/Platform';
import {
    Sub
} from 'Fractal/Platform/Sub';

import {
    Currency
} from './Currency';
import * as Utils from './Utils';
import * as Time from 'Fractal/Time';


/**
 * M O D E L
 */

const DRAGGING_LUFT_GAP = 20;

interface Dragging {
    ref: React.RefObject<HTMLDivElement>;
    start: number;
    delta: Maybe<number>;
}

interface Sliding {
    currency: Maybe<string>;
    duration: number;
    destination: number;
}

const SLIDING_SPEED = 1; // ps/millisecond
const SLIDING_DURATION_MIN = 50; // millisecond
const SLIDING_DURATION_MAX = 300; // millisecond

const calcSlidingDuration = (distance: number): number => Utils.clamp(
    SLIDING_DURATION_MIN,
    SLIDING_DURATION_MAX,
    Math.abs(distance / SLIDING_SPEED)
);

export interface Model {
    currency: string;
    dragging: Maybe<Dragging>;
    sliding: Maybe<Sliding>;
}

export const init = (currency: string): Model => ({
    currency,
    dragging: Nothing,
    sliding: Nothing
});

export const isSame = (left: Model, right: Model): boolean => left.currency === right.currency;

/**
 * U P D A T E
 */

export type Msg
    = { $: 'CHANGE_CURRENCY'; _0: string }
    | { $: 'CHANGE_AMOUNT'; _0: Maybe<string> }
    | { $: 'DRAG_START'; _0: number }
    | { $: 'DRAGGING'; _0: Maybe<Currency>; _1: Maybe<Currency>; _2: number }
    | { $: 'DRAG_END' }
    | { $: 'SLIDE_END' }
    ;

export type Stage
    = { $: 'UPDATED'; _0: boolean; _1: Model }
    | { $: 'AMOUNT_CHANGED'; _0: Maybe<string> }
    ;

const luft = (gap: number, delta: number): Maybe<number> => {
    if (delta > 0) {
        return delta - gap > 0 ? Just(delta - gap) : Nothing;
    }

    if (delta < 0) {
        return delta + gap < 0 ? Just(delta + gap) : Nothing;
    }

    return Nothing;
};

export const update = (msg: Msg, model: Model): Stage => {
    switch (msg.$) {
        case 'CHANGE_CURRENCY': {
            return {
                $: 'UPDATED',
                _0: true,
                _1: {
                    ...model,
                    currency: msg._0
                }
            };
        }

        case 'CHANGE_AMOUNT': {
            return {
                $: 'AMOUNT_CHANGED',
                _0: msg._0
            };
        }

        case 'DRAG_START': {
            return {
                $: 'UPDATED',
                _0: false,
                _1: {
                    ...model,
                    dragging: Just({
                        ref: React.createRef() as React.RefObject<HTMLDivElement>,
                        start: msg._0,
                        delta: Nothing
                    })
                }
            };
        }

        case 'DRAGGING': {
            return model.dragging.chain(
                dragging => Maybe.fromNullable(dragging.ref.current).map(
                    node => luft(DRAGGING_LUFT_GAP, msg._2 - dragging.start).map((delta): Stage => {
                        const border = Utils.clamp(100, 300, node.offsetWidth / 3);

                        if (delta < -border) {
                            return msg._1.map((next): Stage => ({
                                $: 'UPDATED',
                                _0: true,
                                _1: {
                                    ...model,
                                    currency: next.code,
                                    dragging: Nothing,
                                    sliding: Just({
                                        currency: Just(model.currency),
                                        duration: calcSlidingDuration(node.offsetWidth + delta),
                                        destination: -node.offsetWidth
                                    })
                                }
                            })).getOrElse({
                                $: 'UPDATED',
                                _0: false,
                                _1: {
                                    ...model,
                                    dragging: Nothing,
                                    sliding: Just({
                                        currency: Nothing,
                                        duration: calcSlidingDuration(delta),
                                        destination: 0
                                    })
                                }
                            });
                        }

                        if (delta > border) {
                            return msg._0.map((prev): Stage => ({
                                $: 'UPDATED',
                                _0: true,
                                _1: {
                                    ...model,
                                    currency: prev.code,
                                    dragging: Nothing,
                                    sliding: Just({
                                        currency: Just(model.currency),
                                        duration: calcSlidingDuration(node.offsetWidth - delta),
                                        destination: node.offsetWidth
                                    })
                                }
                            })).getOrElse({
                                $: 'UPDATED',
                                _0: false,
                                _1: {
                                    ...model,
                                    dragging: Nothing,
                                    sliding: Just({
                                        currency: Nothing,
                                        duration: calcSlidingDuration(delta),
                                        destination: 0
                                    })
                                }
                            });
                        }

                        return {
                            $: 'UPDATED',
                            _0: false,
                            _1: {
                                ...model,
                                dragging: Just({
                                    ...dragging,
                                    delta: Just(delta)
                                })
                            }
                        };
                    }).getOrElse({
                        $: 'UPDATED',
                        _0: false,
                        _1: {
                            ...model,
                            dragging: Just({
                                ...dragging,
                                delta: Nothing
                            })
                        }
                    })
                )
            ).getOrElse({
                $: 'UPDATED',
                _0: false,
                _1: {
                    ...model,
                    dragging: Nothing
                }
            });
        }

        case 'DRAG_END': {
            return {
                $: 'UPDATED',
                _0: false,
                _1: model.dragging.chain(dragging => dragging.delta).cata({
                    Nothing: () => ({
                        ...model,
                        dragging: Nothing
                    }),
                    Just: delta => ({
                        ...model,
                        dragging: Nothing,
                        sliding: Just({
                            currency: Nothing,
                            duration: calcSlidingDuration(delta),
                            destination: 0
                        })
                    })
                })
            };
        }

        case 'SLIDE_END': {
            return {
                $: 'UPDATED',
                _0: false,
                _1: {
                    ...model,
                    sliding: Nothing
                }
            };
        }
    }
};

export const subscriptions = (model: Model): Sub<Msg> => {
    return model.sliding.cata({
        Nothing: () => Sub.none,
        Just: sliding => Time.every(sliding.duration, (): Msg => ({ $: 'SLIDE_END' }))
    });
};

/**
 * V I E W
 */

const Root = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    padding: 1em 0;
    color: #fff;
    user-select: none;
    overflow-x: hidden;
`;

interface CarouselProps {
    shift: number;
    sliding: Maybe<Sliding>;
    prev: Maybe<Currency>;
    next: Maybe<Currency>;
}

interface CarouselAttrs {
    style: {
        [ property: string ]: string;
    };
}

const Carousel = styled.div.attrs<CarouselProps, CarouselAttrs>({
    style: props => props.sliding.cata({
        Nothing: () => ({
            transform: `translate3d(${props.shift}px, 0, 0)`
        }),

        Just: sliding => ({
            transform: `translate3d(${sliding.destination}px, 0, 0)`,
            transition: `transform ${sliding.duration}ms ease-out`
        })
    })
})`
    flex: 1 0 auto;
    display: flex;
    justify-content: ${props => {
        if (props.prev.isNothing()) {
            return 'flex-start';
        }

        if (props.next.isNothing()) {
            return 'flex-end';
        }

        return 'center';
    }};
`;

const Main = styled.div`
    display: flex;
    align-items: center;
    font-size: 3em;
    font-weight: 300;
    line-height: 1;
`;

const Info = styled.div`
    flex: 0 1 auto;
    display: flex;
    justify-content: space-between;
    margin-top: .5em;
    opacity: .6;
`;

const Input = styled.input`
    width: 100%;
    padding: 0 0 0 1em;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    outline: none;
    text-align: right;
    -moz-appearance: textfield;

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
`;

const Small = styled.small`
    font-size: .8em;
`;

const Line = styled.ul`
    margin: .5em 0 0 -.1em;
    padding: 0 2em;
    list-style: none;
    text-align: center;
    font-size: 1.6em;
    line-height: 1;
`;

const Point = styled.li<{
    active: boolean;
}>`
    display: inline-block;
    margin-left: .1em;
    ${props => props.active ? '' : `
        opacity: .5;
    `}

    &:before {
        content: "•"
    }
`;

const calcStep = (amount: string): number => {
    if (/(\.|,)\d[1-9]\d*/.test(amount)) {
        return 0.01;
    }

    if (/(\.|,)[1-9]\d*/.test(amount)) {
        return 0.1;
    }

    return 1;
};

const stringToAmount = (input: string): Maybe<string> => {
    const result = input.trim().replace(/^(-|\+)?(-|\+)*(0*(?=\d+))?(\d*(\.|,)?\d{0,2})(.*)$/, '$1$4');

    return result === '' ? Nothing : Just(result);
};

const Slide = styled<{
    dispatch: Dispatch<Msg>;
    amount: string;
    currency: Currency;
    donor: Maybe<Currency>;
    preventClicking: boolean;
    className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>>(({
    dispatch,
    currency,
    amount,
    donor,
    className,
    preventClicking,
    ...inputProps
}) => (
    <label className={className} onClick={event => {
        if (preventClicking) {
            event.preventDefault();
        }
    }}>
        <Main>
            {currency.code}

            <Input
                type="number"
                value={amount}
                step={calcStep(amount).toString()}
                onChange={event => dispatch({
                    $: 'CHANGE_AMOUNT',
                    _0: stringToAmount(event.currentTarget.value)
                })}
                {...inputProps}
            />
        </Main>

        <Info>
            <span>You have <Small>{currency.symbol}</Small>{currency.amount}</span>

            {donor.chain(donorCurrency => donorCurrency.convertTo(1, currency).map(rate => (
                <span>
                    <Small>{currency.symbol}</Small>1&nbsp;=&nbsp;
                    <Small>{donorCurrency.symbol}</Small>{Utils.round(2, rate)}
                </span>
            ))
            ).getOrElse(<span></span>)}
        </Info>
    </label>
))`
    box-sizing: border-box;
    flex: 1 0 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 2em;
`;

const extractCurrencies = (currencies: Array<Currency>, currentCode: string): Maybe<{
    prev: Maybe<Currency>;
    current: Currency;
    next: Maybe<Currency>;
}> => {
    const { prev, current, next } = currencies.reduce((acc, currency) => {
        if (currency.code === currentCode) {
            return { ...acc, current: Just(currency) };
        }

        if (acc.current.isNothing()) {
            return { ...acc, prev: Just(currency) };
        }

        if (acc.next.isNothing()) {
            return { ...acc, next: Just(currency) };
        }

        return acc;
    }, {
        prev: Nothing as Maybe<Currency>,
        current: Nothing as Maybe<Currency>,
        next: Nothing as Maybe<Currency>
    });

    return current.map(currency => ({
        prev,
        current: currency,
        next
    }));
};

interface DraggingMouseEvents<T> {
    onTouchStart?(event: React.TouchEvent<T>): void;
    onTouchMove?(event: React.TouchEvent<T>): void;
    onTouchEnd?(event: React.TouchEvent<T>): void;
}

function buildDraggingMouseEvents<T>(
    dispatch: Dispatch<Msg>,
    prev: Maybe<Currency>,
    next: Maybe<Currency>,
    dragging: Maybe<Dragging>
): DraggingMouseEvents<T> {
    return dragging.cata<DraggingMouseEvents<T>>({
        Nothing: () => ({
            onTouchStart: event => Maybe.fromNullable(event.touches[ 0 ]).cata({
                Nothing: () => {
                    // do nothing
                },
                Just: touch => dispatch({ $: 'DRAG_START', _0: touch.screenX })
            })
        }),
        Just: ({ ref }) => ({
            ref,
            onTouchMove: event => Maybe.fromNullable(event.touches[ 0 ]).cata({
                Nothing: () => {
                    // do nothing
                },
                Just: touch => dispatch({ $: 'DRAGGING', _0: prev, _1: next, _2: touch.screenX })
            }),
            onTouchEnd: () => dispatch({ $: 'DRAG_END' })
        })
    });
}

export const View: React.StatelessComponent<{
    dispatch: Dispatch<Msg>;
    model: Model;
    amount: string;
    currencies: Array<Currency>;
    donor: Maybe<Currency>;
    autoFocus?: boolean;
}> = ({ dispatch, model, amount, currencies, donor, autoFocus }) => extractCurrencies(
    currencies,
    model.sliding.chain(sliding => sliding.currency).getOrElse(model.currency)
).fold(() => null, ({ prev, current, next }) => (
    <Root {...model.sliding.isJust() ? {} : buildDraggingMouseEvents(dispatch, prev, next, model.dragging)}>
        <Carousel
            shift={model.dragging.chain(dragging => dragging.delta).getOrElse(0)}
            sliding={model.sliding}
            prev={prev}
            next={next}
        >
            {prev.cata({
                Nothing: () => null,
                Just: currency => (
                    <Slide
                        dispatch={dispatch}
                        amount=""
                        currency={currency}
                        donor={donor}
                        preventClicking={model.sliding.isJust()}
                        disabled
                    />
                )
            })}

            <Slide
                dispatch={dispatch}
                amount={amount}
                currency={current}
                donor={donor}
                autoFocus={autoFocus}
                preventClicking={model.sliding.isJust()}
            />

            {next.cata({
                Nothing: () => null,
                Just: currency => (
                    <Slide
                        dispatch={dispatch}
                        amount=""
                        currency={currency}
                        donor={donor}
                        preventClicking={model.sliding.isJust()}
                        disabled
                    />
                )
            })}
        </Carousel>
        <Line>
            {currencies.map(currency => (
                <Point
                    active={currency.code === model.currency}
                    onClick={() => dispatch({ $: 'CHANGE_CURRENCY', _0: currency.code })}
                    key={currency.code}
                />
            ))}
        </Line>
    </Root>
));
