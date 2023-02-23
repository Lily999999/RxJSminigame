import { buffer, filter, map, mergeMap, scan, share, takeUntil } from 'rxjs/operators';
import { fromEvent, interval, timer, merge } from 'rxjs';
import { Box } from './box';
import { Frogger } from './frogger';
import { Timebar } from './timebar';
import './style.css'

type PlayerState = {
    raduis?: number,
    x?: number,
    y?: number,
    autoflow?: boolean
}

type CarState = {
    x?: number,
    y?: number,
}

type GameState = {
    state?: "end" | "restart" | "start" | "win" | "finish",
    restartFlag?: boolean
}

type DriftwoodState = {
    x?: number,
    y?: number
}

type TurtleState = {
    x?: number,
    y?: number
}

type CrocodileState = {
    x?: number,
    y?: number
}

// state should be immutable
// optional property is used to describe partly state change
type State = Readonly<{
    playerState?: PlayerState,
    carStates?: CarState[],
    driftwoodStates?: DriftwoodState[],
    turtleStates?: TurtleState[],
    gameState?: GameState,
    finishLocs?: Set<number>,
    timeLastState?: number,
    turtleDive?: boolean,
    crocodileState?: CrocodileState,  // only one crocodile
}>

function main() {
    const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

    document.querySelectorAll(".btn-restart").forEach(e => {
        e.addEventListener("click", () => {
            document.dispatchEvent(new CustomEvent<GameState>("game_state", {
                detail: {
                    state: "restart"
                }
            }))
        })
    })

    // The following are the most upstream events that control all game logic, and the occurrence of these events will change the state of the game
    // Player-controlled events
    const keydown = fromEvent<KeyboardEvent>(document, "keydown")
    const keyup = fromEvent<KeyboardEvent>(document, "keyup")
    // Frog sticking to plank or turtle
    const attachToflow = fromEvent<CustomEvent<{ x: number }>>(document, "flow")
    // game state change event
    const gameStateChange = fromEvent<CustomEvent<GameState>>(document, "game_state")
    const finishEvent = fromEvent<CustomEvent<{ num: number }>>(document, "finish")
    // Game entity refresh event (understood as a timed event)
    const entityTick = interval(15).pipe(share())

    // initial state
    const initialState: State = {
        playerState: {
            raduis: 30,
            x: 580,
            y: 1160,
            autoflow: false,
        },
        carStates: new Array(12).fill(0).map((_, index) => {
            // const left = (Math.floor(index / 3)) % 2 == 1
            return {
                x: 280 * index,
                y: 1280 - (102 * (Math.floor(index / 3) + 2) + 30)
            }
        }),
        driftwoodStates: [{ x: -400, y: 255 }, { x: 340, y: 255 },
        { x: -250, y: 449 }, { x: 160, y: 449 }, { x: 570, y: 449 }],
        turtleStates: [{ x: 960, y: 352 }, { x: 220, y: 352 },
        { x: 960, y: 546 }, { x: 540, y: 546 }, { x: 120, y: 546 }],
        finishLocs: new Set(),
        timeLastState: 1.0,
        crocodileState: { x: 70, y: 255 },
    }

    // Initialize all entities
    const timebar = new Timebar(svg).setTimePercent(initialState.timeLastState!)
    const woods = initialState.driftwoodStates!.map((state, index) => new Box(svg, { x: state.x!, y: state.y!, width: index > 1 ? 250 : 400, height: 60 }, "#DAA520"))
    const turtles = initialState.turtleStates!.map((state, index) => new Box(svg, { x: state.x!, y: state.y!, width: index > 1 ? 250 : 400, height: 60 }, "blue"))
    const frogger = new Frogger(svg, { raduis: initialState.playerState!.raduis!, x: initialState.playerState!.x!, y: initialState.playerState!.y! })
    const finishFroggers = new Array(5).fill(1).map((_, idx) => new Frogger(svg, {
        raduis: initialState.playerState!.raduis!,
        y: initialState.playerState!.raduis! + 165,
        x: idx * 203 + initialState.playerState!.raduis! + 43,
        hide: true
    }))
    // The view of the cart and crocodile is under the frog, indicating that these things can cover (collide or eat) the frog
    const cars = initialState.carStates!.map(state => new Box(svg, { x: state.x!, y: state.y!, width: 100, height: 60 }))
    const crocodile = new Box(svg, {
        x: initialState.crocodileState!.x!,
        y: initialState.crocodileState!.y!,
        width: 200,
        height: 60
    }, "red")

    const timeTick$ = entityTick.pipe(
        map<number, State>(_ => {
            return {
                timeLastState: - 0.0005,
                gameState: {
                    restartFlag: false
                }
            }
        }))

    // player move logic
    const playerMove$ = keydown.pipe(
        filter(({ code }) => judgeIsMoveControlKey(code)),
        filter(({ repeat }) => !repeat),
        mergeMap(d => timer(0, 200)
            .pipe(
                takeUntil(keyup.pipe(
                    filter(({ code }) => code === d.code)
                )),
                map(_ => d)
            )),
        map(({ code }) => convertCodeToMoveArgs(code)),
        map<number[], State>(([x, y]) => { return { playerState: { x, y } } })
    )

    // car move logic
    const carMove$ = entityTick.pipe(
        map<number, State>(() => {
            return {
                carStates: handleCarStates()
            }
        }),
    )

    const woodMove$ = entityTick.pipe(
        map<number, State>(() => {
            return {
                driftwoodStates: [
                    { x: 2 }, { x: 2 },
                    { x: 1 }, { x: 1 }, { x: 1 }
                ]
            }
        }),
    )

    const crocodileMove$ = entityTick.pipe(
        map<number, State>(() => {
            return {
                crocodileState: {
                    x: 2
                }
            }
        })
    )

    const turtleMove$ = entityTick.pipe(
        map<number, State>(() => {
            return {
                turtleStates: [
                    { x: -3 }, { x: -3 },
                    { x: -1 }, { x: -1 }, { x: -1 }
                ]
            }
        }),
    )

    const turtleDive$ = entityTick.pipe(
        buffer(timer(2000, 3000)),
        map<number[], State>(() => {
            return {
                turtleDive: true
            }
        })
    )

    const turtleSurface$ = entityTick.pipe(
        buffer(timer(0, 3000)),
        map<number[], State>(() => {
            return {
                turtleDive: false
            }
        })
    )

    const attchFlow$ = attachToflow.pipe(
        map<CustomEvent<{ x: number }>, State>(evt => {
            return {
                playerState: {
                    x: evt.detail.x,
                    autoflow: true,
                }
            }
        })
    )

    const gameState$ = gameStateChange.pipe(
        map<CustomEvent<GameState>, State>(evt => {
            return {
                gameState: evt.detail
            }
        })
    )

    const finishEvent$ = finishEvent.pipe(
        map<CustomEvent<{ num: number }>, State>(evt => {
            const set = new Set<number>()
            set.add(evt.detail.num)
            return {
                gameState: {
                    state: "finish"
                },
                finishLocs: set,
            }
        })
    )

    // reduce the new state
    const reducer = (state: State, value: State): State => {
        const {
            playerState, carStates, gameState,
            timeLastState, turtleStates, driftwoodStates,
            finishLocs,
            turtleDive, crocodileState
        } = state
        const {
            playerState: playerStateChange,
            carStates: carStateChanges,
            gameState: gameStateChange,
            timeLastState: timeLastStateChange,
            turtleStates: turtleStatesChange,
            driftwoodStates: driftwoodStatesChange,
            finishLocs: finishLocsChange,
            turtleDive: turtleDiveChange,
            crocodileState: crocodileStateChange,
        } = value
        if (gameStateChange?.state == "restart") {
            return { ...initialState, gameState: { ...initialState.gameState, restartFlag: true } }
        }
        if (gameStateChange?.state == "finish") {
            return { ...initialState, finishLocs: mergeSet(finishLocs!, finishLocsChange ? finishLocsChange : new Set()) }
        }
        return {
            playerState: {
                raduis: playerState?.raduis! + (playerStateChange?.raduis || 0),
                x: coreceX(playerState?.x! + (playerStateChange?.x || 0)),
                y: coreceY(playerState?.y! + (playerStateChange?.y || 0)),
                autoflow: playerStateChange ? (playerStateChange.autoflow ? playerStateChange.autoflow : false) : false
            },
            carStates: carStateChanges ? carStates?.map((s, idx) => mergeCarStateChange(s, carStateChanges[idx])) : carStates,
            gameState: gameStateChange ? {
                state: gameStateChange?.state ? gameStateChange.state : gameState?.state,
                restartFlag: gameStateChange.restartFlag != undefined ? gameStateChange.restartFlag : gameState?.restartFlag
            } : gameState,
            timeLastState: timeLastState! + (timeLastStateChange || 0),
            turtleStates: turtleStatesChange ? turtleStates?.map((s, idx) => {
                return {
                    x: coreceRepeatX(s.x! + (turtleStatesChange[idx].x || 0), idx > 1 ? 250 : 400),
                    y: s.y
                }
            }) : turtleStates,
            driftwoodStates: driftwoodStatesChange ? driftwoodStates?.map((s, idx) => {
                return {
                    x: coreceRepeatX(s.x! + (driftwoodStatesChange[idx].x || 0), idx > 1 ? 250 : 400),
                    y: s.y
                }
            }) : driftwoodStates,
            turtleDive: turtleDiveChange != null ? turtleDiveChange : turtleDive,
            finishLocs: finishLocsChange ? mergeSet(finishLocs!, finishLocsChange) : finishLocs,
            crocodileState: {
                x: coreceRepeatX(crocodileState!.x! + (crocodileStateChange?.x || 0), 400),
                y: crocodileState!.y!
            }
        }
    }

    const mergeSet = (set: Set<number>, add: Set<number>): Set<number> => {
        const s = new Set<number>(set.values())
        add.forEach(a => s.add(a))
        return s
    }

    const mergeCarStateChange = (s: CarState, change: CarState): CarState => {
        return {
            x: coreceRepeatX(s.x! + (change.x || 0)),
            y: s.y
        }
    }

    const judgeFinish = (player: PlayerState): number | undefined => {
        for (let i = -1; i < 6; i++) {
            let x = i * 203 + initialState.playerState!.raduis! + 43
            let y = initialState.playerState!.raduis! + 165
            if (Math.sqrt(Math.pow(x - player.x!, 2) + Math.pow(y - player.y!, 2)) <= 2 * initialState.playerState?.raduis!) {
                return i
            }
        }
        return undefined
    }

    // Determine if there is a collision
    const judgeCollision = (carState: CarState, playerState: PlayerState): boolean => {
        const left = carState.x!
        const right = carState.x! + 100
        const top = carState.y!
        const bottom = carState.y! + 60
        const x = playerState.x!
        const y = playerState.y!
        const r = playerState.raduis!
        // console.log({left, right, top, bottom, x, y, r})
        // Determine the distance from the center of the circle to the closest point to the rectangle, if it is less than the radius, it is regarded as a collision
        switch (true) {
            case x < left && playerState.y! > top && y < bottom: {
                return Math.abs(left - x) < r
            }
            case x < left && y < top: {
                return Math.sqrt(Math.pow(x - left, 2) + Math.pow(y - top, 2)) < r
            }
            case x < right && x > left && playerState.y! < top: {
                return Math.abs(top - y) < r
            }
            case x > right && y < top: {
                return Math.sqrt(Math.pow(x - right, 2) + Math.pow(y - top, 2)) < r
            }
            case x > right && y > top && y < bottom: {
                return Math.abs(x - right) < r
            }
            case x > right && y > bottom: {
                return Math.sqrt(Math.pow(x - right, 2) + Math.pow(y - bottom, 2)) < r
            }
            case x > left && x < right && y > bottom: {
                return Math.abs(y - bottom) < r
            }
            case x < left && y > bottom: {
                return Math.sqrt(Math.pow(x - left, 2) + Math.pow(y - bottom, 2)) < r
            }
        }
        // If the center of the circle is inside the rectangle, it is also considered a collision
        return x > left && x < right && y > top && y < bottom
    }

    const judgeInside = (x: number, y: number, width: number, playerState: PlayerState) => {
        const r = playerState.raduis!
        const left = x - r
        const right = x + width + r
        const top = y
        const bottom = y + 60
        const cx = playerState.x!
        const cy = playerState.y!
        return cx >= left && cx <= right && cy >= top && cy <= bottom
    }

    const judgeInline = (y: number, playerState: PlayerState) => {
        const top = y
        const bottom = y + 60
        const cy = playerState.y!
        return cy >= top && cy <= bottom
    }

    // loop x
    const coreceRepeatX = (num: number, width = 100): number => num > 960 ? num - 960 - width : num < -width ? num + 960 + width : num
    

    const coreceX = (num: number, raduis: number = 30): number => 
        // keep y in the range of [boundaryBoxX + marginEnd, canvasWidth - boundaryBoxX - marginStart]
        Math.max(Math.min(num, 960 - raduis - 43), raduis + 43)
    

    const coreceY = (num: number, raduis: number = 30): number => 
        // keep y in the range of [boundaryBoxY + marginTop, canvasHeight - boundaryBoxY - marginBottom]
        Math.max(Math.min(num, 1280 - raduis - 90), raduis + 165)

    const convertCodeToMoveArgs = (code: string, stepX = 102, stepY = 97): number[] => 
        code === 'ArrowLeft' ? [-stepX, 0] : (code == "ArrowRight") ? [stepX, 0] : ((code == "ArrowUp") ? [0, -stepY] : [0, stepY])
    
    const judgeIsMoveControlKey = (code: string): boolean => 
        code === 'ArrowLeft' || code === 'ArrowRight' || code == "ArrowUp" || code == "ArrowDown"

    const handleCarStates = (): CarState[] => {
        return new Array(12).fill(0).map((_, idx) => {
            // means the car is running to the left
            const left = Math.floor(idx / 3) % 2 == 1
            return {
                x: left ? -4 : 1
            }
        })
    }

    const renderPlayer = (state: State) => {
        const { playerState } = state
        // render the frog
        frogger.attr("r", playerState?.raduis!)
        frogger.attr("cx", playerState?.x!)
        frogger.attr("cy", playerState?.y!)

        // Check if the frog has reached the end
        const finish = judgeFinish(playerState!)
        if (finish) {
            document.dispatchEvent(new CustomEvent<{ num: number }>("finish", {
                detail: {
                    num: finish
                }
            }))
        }
    }

    const renderCar = (state: State) => {
        const { playerState, carStates } = state
        cars.forEach((car, index) => {
            const s = carStates![index]!
            car.x = s.x!
            car.y = s.y!
        })
        // Check to see if the frog was killed by car
        if (carStates?.find(carState => judgeCollision(carState, playerState!))) {
            document.dispatchEvent(new CustomEvent<GameState>("game_state", {
                detail: {
                    state: "end"
                }
            }))
        }
    }

    const renderTimebar = (state: State) => {
        const { timeLastState } = state
        if (timeLastState && timeLastState > 0) {
            timebar.setTimePercent(timeLastState)
        } else if (state.gameState?.state != "end") {
            document.dispatchEvent(new CustomEvent<GameState>("game_state", {
                detail: {
                    state: "end"
                }
            }))
        }
    }

    const renderFlow = (state: State) => {
        const {
            playerState,
            turtleStates,
            driftwoodStates,
            turtleDive,
            crocodileState,
        } = state
        turtles.forEach((turtle, index) => {
            const s = turtleStates![index]!
            turtle.x = s.x!
            turtle.y = s.y!
        })

        woods.forEach((wood, index) => {
            const s = driftwoodStates![index]!
            wood.x = s.x!
            wood.y = s.y!
        })

        if (turtleDive! == true) {
            turtles.forEach((turtle) => {
                turtle.hide()
            })
        } else {
            turtles.forEach((turtle) => {
                turtle.show()
            })
        }

        crocodile.x = crocodileState?.x!
        crocodile.y = crocodileState?.y!

        // If it is already bound, it will not be moved.
        if (playerState!.autoflow!) return
        driftwoodStates?.forEach((woodState, index) => {
            if (judgeInside(woodState.x!, woodState.y!, index > 1 ? 250 : 400, playerState!)) {
                document.dispatchEvent(new CustomEvent<{ x: number }>("flow", {
                    "detail": {
                        x: index > 1 ? 0.20 : 0.40
                    }
                }))
                return
            }
        })
        if (!driftwoodStates?.find((woodState, index) => judgeInside(woodState.x!, woodState.y!, index > 1 ? 250 : 400, playerState!))) {
            const statesInline = driftwoodStates?.filter((woodState) => judgeInline(woodState.y!, playerState!))
            if (statesInline?.length) {
                document.dispatchEvent(new CustomEvent<GameState>("game_state", {
                    detail: {
                        state: "end"
                    }
                }))
            }
        }
        const statesInline = turtleStates?.filter((turtleState) => judgeInline(turtleState.y!, playerState!))
        // If you can find a box, make sure that the frog has posted the box on it.
        turtleStates?.forEach((turtleState, index) => {
            if (judgeInside(turtleState.x!, turtleState.y!, index > 1 ? 250 : 400, playerState!)) {
                document.dispatchEvent(new CustomEvent<{ x: number }>("flow", {
                    "detail": {
                        x: index > 1 ? -0.20 : -0.6
                    }
                }))
            }
        })
        if (!turtleStates?.find((turtleState, index) => judgeInside(turtleState.x!, turtleState.y!, index > 1 ? 250 : 400, playerState!))) {
            // If it is not found, it means that the frog does not have a box attached, then find all the boxes in the same line as the frog, if it is not empty, it will fail
            if (statesInline?.length) {
                document.dispatchEvent(new CustomEvent<GameState>("game_state", {
                    detail: {
                        state: "end"
                    }
                }))
            }
        }
        // If the turtle dives at this time and is currently on the turtle line, it will fail
        if (turtleDive! && statesInline?.length) {
            document.dispatchEvent(new CustomEvent<GameState>("game_state", {
                detail: {
                    state: "end"
                }
            }))
        }
    }

    const renderFinishedLoc = (state: State) => {
        const { finishLocs } = state
        if (finishLocs?.size! >= 5) {
            document.dispatchEvent(new CustomEvent<GameState>("game_state", {
                detail: {
                    state: "win"
                }
            }))
            return
        }
        finishLocs?.forEach(v => finishFroggers[v]?.show())
        finishFroggers.filter((_, idx) => !finishLocs?.has(idx)).forEach(e => e.hide())
    }

    const render = (state: State) => {
        const { gameState } = state
        if (gameState?.restartFlag) {
            document.querySelector<HTMLElement>("#end")!.style.display = "none"
            document.querySelector<HTMLElement>("#win")!.style.display = "none"
        }
        if (gameState?.state == "end") {
            document.querySelector<HTMLElement>("#end")!.style.display = "block"
            return
        }
        if (gameState?.state == "win") {
            document.querySelector<HTMLElement>("#win")!.style.display = "block"
            return
        }
        // Game end, stop rendering
        renderCar(state)
        renderFlow(state)
        renderPlayer(state)
        renderTimebar(state)
        renderFinishedLoc(state)
    }

    // eventChannel merges all Observables and saves/accumulates state via scan
    // Subscribe to receive an immutable state when any event fires
    // Operations that require state content must get the value of state by subscribing to it
    const eventChannel = merge(
        playerMove$, carMove$,
        attchFlow$, gameState$,
        timeTick$, turtleMove$,
        woodMove$, turtleDive$,
        finishEvent$, turtleSurface$,
        crocodileMove$,
    )
        // remember state
        // because of the scan func receive only one reducer func param
        // the func should be able to handle all fields of the state
        .pipe(scan(reducer, initialState))

    eventChannel.subscribe(render)
}

if (typeof window !== "undefined") {
    window.onload = () => {
        main();
    };
}