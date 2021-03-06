import { IPlayableAnimation } from './interfaces/IPlayableAnimation';
import * as azmaps from "azure-maps-control";
import { GroupAnimationOptions } from './options/GroupAnimationOptions';
import { setTimeout } from './static';

/** The events supported by the `GroupAnimation`. */
export interface GroupAnimationEvents {

    /** Event fired when the animation has completed. */
    oncomplete: void;
}

/** Group animation handler. */
export class GroupAnimation extends azmaps.internal.EventEmitter<GroupAnimationEvents> {
    
    private _animations: (IPlayableAnimation | GroupAnimation)[];
    private _cancelAnimations = false;
    private _isPlaying = false;

    private _options: GroupAnimationOptions = {
        playType: 'together',
        interval: 100,
        autoPlay: false
    };
    
    public _onComplete = () => {};

    /**************************
    * Constructor
    ***************************/

    /**
     * Group animation handler.
     * @param animations Array of animations to handle.
     */
    constructor(animations: (IPlayableAnimation | GroupAnimation)[], options?: GroupAnimationOptions) {
        super();

        this._animations = animations;

        if(options){
            this.setOptions(options);
        } else {
            this._calculateDuration();
        }
    }

    /**************************
    * Public functions
    ***************************/

    /** Disposes the animation. */
    public dispose(): void {
        this.stop();
        this._options = null;
        this._animations = null;
        this._onComplete = null;
        this._isPlaying = null;
        this._cancelAnimations = null;
    }

    /** Gets the duration of the animation. */
    public getDuration(): number {
        return this._calculateDuration();
    }

    /** Gets the animation options. */
    public getOptions(): GroupAnimationOptions {
        return Object.assign({}, this._options);
    }

    /** Checks to see if the animaiton is playing. */
    public isPlaying(): boolean {
        return this._isPlaying;
    }

    /**
     * Plays the group of animations.
     */
    public play(): void {
        this._cancelAnimations = false;

        switch(this._options.playType){
            case 'together':
                this._playTogether();
                break;
            case 'sequential':
                this._playSeq();    
                break;
            case 'interval':
                this._playInterval();
                break;
        }
    }

    /** 
     * Stops all animations and jumps back to the beginning of each animation.
     */
    public reset(): void {
        //Prevent any queued animations from starting.
        this._cancelAnimations = true;

        //Stop all animations that are playing. 
        if (this._animations && this._animations.length > 0) {
            for (var i = 0; i < this._animations.length; i++) {
                this._animations[i].reset();
            }
        }

        this._isPlaying = false;
    }

    /** Stops all animations and jumps to the final state of each animation. */
    public stop(): void {
        //Prevent any queued animations from starting.
        this._cancelAnimations = true;

        //Stop all animations that are playing. 
        if (this._animations && this._animations.length > 0) {
            for (var i = 0; i < this._animations.length; i++) {
                this._animations[i].stop();
            }
        }

        this._isPlaying = false;
    }

    /**
     * Sets the options of the animation.
     * @param options Options to apply to the animation.
     */
    public setOptions(options: GroupAnimationOptions): void {
        if(options){
            var isPlaying = this._isPlaying;

            if(isPlaying){
                this.stop();
            }

            if(options.playType && ['together', 'sequential', 'interval'].indexOf(options.playType) !== -1){
                this._options.playType = options.playType;
            }

            if (typeof options.autoPlay === 'boolean') {
                this._options.autoPlay = options.autoPlay;

                if(!isPlaying && options.autoPlay){
                    isPlaying = true;
                }
            }

            if(typeof options.interval === 'number'){
                this._options.interval = (options.interval > 0) ? Math.abs(options.interval) : 100;
            }

            this._calculateDuration();

            if(isPlaying){
                this.play();
            }
        }
    }

    /**************************
    * Private functions
    ***************************/

    /**
     * Plays an array of animations together at the same time.
     */
    private _playTogether(): void {
        if (this._animations && this._animations.length > 0) {
            this._isPlaying = true;

            for (var i = 0; i < this._animations.length; i++) {
                if(i === this._animations.length - 1){
                    this._animations[i]._onComplete = () => {
                        this._isPlaying = false;

                        //Animations complete.
                        this._invokeEvent('oncomplete', null);
                    };
                }

                this._animations[i].play();
            }
        }
    }

    /**
     * Plays an array of animations sequentially. Looping of any animation will be disabled.
     */
    private _playSeq(): void {
        if (this._animations && this._animations.length > 0) {
            this._isPlaying = true;
            var idx = 0;

            var callback = () => {
                if(this._isPlaying){
                    if (idx > 0) {
                        //Only use the callback once.
                        this._animations[idx - 1]._onComplete = null;
                    }

                    if (!this._cancelAnimations && idx < this._animations.length) {
                        this._animations[idx]._onComplete = callback;
                        this._animations[idx].play();
                        idx++;
                    } else {
                        this._isPlaying = false;

                        //Animations complete.
                        this._invokeEvent('oncomplete', null);
                    }
                }
            };

            callback();
        }
    }

    /**
     * Plays an array of animations one by one based on an interval. 
     */
    private _playInterval(): void {
        if (this._animations && this._animations.length > 0) {
            this._isPlaying = true;
            var self = this;

            var idx = 0;
            var p = function () {
                if(self._isPlaying){
                    if (!self._cancelAnimations && idx < self._animations.length) {
                        if(idx === self._animations.length - 1){
                            self._animations[idx]._onComplete = () => {
                                if(self._isPlaying){
                                    self._isPlaying = false;

                                    //Animations complete.
                                    self._invokeEvent('oncomplete', null);
                                }
                            };
                        }

                        self._animations[idx].play();
                        idx++;

                        setTimeout(function () {
                            p();
                        }, self._options.interval);
                    } else if (self._cancelAnimations && self._isPlaying){
                        self._isPlaying = false;

                        //Animations complete.
                        self._invokeEvent('oncomplete', null);
                    }
                }
            }
            p();
        }
    }

    /** Calculates the total duration of the animation. */
    private _calculateDuration(): number {
        var maxPostInterval = 0;
        var intervalRemaining = 0;
        var max = 0;
        var sum = 0;
        var totalInterval = this._options.interval * this._animations.length;

        this._animations.forEach((a, i, arr) => {
            var d = a.getDuration();

            intervalRemaining = totalInterval - i * this._options.interval;

            if(intervalRemaining < d){
                maxPostInterval = Math.max(maxPostInterval, d - intervalRemaining);
            }

            max = Math.max(max, d);
            sum += d;
        });

        var duration = 0;

        switch(this._options.playType){
            case 'together':
                duration = max;
                break;
            case 'sequential':
                duration = sum;
                break;
            case 'interval':                
                duration = maxPostInterval + totalInterval;
                break;
        }

        return duration;
    }
}