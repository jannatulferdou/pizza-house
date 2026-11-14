import { T } from "../../app/Locale";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDown, Flame, MoveDown } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Catalog } from "../catalog/Catalog";
import { Offers } from "../catalog/Offers";
import { PizzaCustomizer } from "./PizzaCustomizer";
import { KitchenStory } from "./KitchenStory";
import type { PlateFinish } from "../../shared/types";
import "./home.css";
gsap.registerPlugin(ScrollTrigger);
const PizzaScene = lazy(() => import("./PizzaScene"));
const chapters = [
    {
        tag: "01 / THE FIRST CRUSH",
        title: (<><T space>{"Love at"}</T><br />
        <em><T space>{"first slice."}</T></em>
      </>),
        text: "A golden edge. A little char. A whole lot of heart. Meet our house margherita.",
    },
    {
        tag: "02 / NOTHING TO HIDE",
        title: (<><T space>{"Good things."}</T><br />
        <em><T space>{"Inside out."}</T></em>
      </>),
        text: "Bright tomato, creamy mozzarella and fresh basil. Every layer brings something to the table.",
    },
    {
        tag: "03 / MADE FOR THIS MOMENT",
        title: (<><T space>{"All together."}</T><br />
        <em><T space>{"All yours."}</T></em>
      </>),
        text: "Some things just belong together. Find your favorite and make a little room for good food.",
    },
    {
        tag: "04 / YOUR FIRST BITE",
        title: (<><T space>{"Go on."}</T><br />
        <em><T space>{"Take a slice."}</T></em>
      </>),
        text: "The golden edge. That little cheese pull. Now make your favorite a little more you.",
    },
];
function PizzaFallback() {
    return (<div className="pizza-fallback">
      <img src="/images/pizza.jpg" alt="House margherita pizza"/>
      <span><T space>{"The house original"}</T></span>
    </div>);
}
export default function Home() {
    const [finish, setFinish] = useState<PlateFinish>("Ivory");
    const [paused, setPaused] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (paused)
            return;
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
            const context = gsap.context(() => {
                gsap.from(".house-hero .hero-enter", {
                    y: 35,
                    opacity: 0,
                    duration: 1,
                    stagger: 0.12,
                    ease: "power3.out",
                });
                gsap.to(".hero-watermark", {
                    xPercent: -12,
                    ease: "none",
                    scrollTrigger: {
                        trigger: ".house-hero",
                        start: "top top",
                        end: "bottom top",
                        scrub: true,
                    },
                });
                gsap.utils.toArray<HTMLElement>(".home-arrival").forEach((element) => {
                    gsap.from(element, {
                        y: 45,
                        opacity: 0,
                        duration: 0.85,
                        ease: "power2.out",
                        scrollTrigger: { trigger: element, start: "top 92%", once: true },
                    });
                });
            }, root);
            return () => context.revert();
        });
        return () => media.revert();
    }, [paused]);
    return (<div className="house-home" ref={root} data-paused={paused}>
      <button className="motion-toggle" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
        <T>{paused ? "Resume motion" : "Pause motion"}</T>
      </button>
      <section className="house-hero" id="home" aria-labelledby="house-title">
        <div className="house-topline hero-enter">
          <span>
            <i /><T space>{"GOOD FOOD. GREAT COMPANY."}</T></span>
          <span><T space>{"A LITTLE SLICE OF THE GOOD LIFE \u2197"}</T></span>
        </div>
        <div className="hero-watermark" aria-hidden="true"><T space>{"BUON APPETITO"}</T></div>
        <div className="house-hero-copy">
          <span className="eyebrow hero-enter"><T space>{"PIZZA HOUSE / THE HOUSE ORIGINAL"}</T></span>
          <h1 id="house-title" className="hero-enter"><T space>{"A little crust."}</T><br /><T space>{"A lot of"}</T><em><T space>{"soul."}</T></em>
          </h1>
          <p className="hero-enter"><T space>{"For the first bite. The last slice."}</T><br /><T space>{"And all the good company in between."}</T></p>
          <div className="house-hero-actions hero-enter">
            <a className="pill dark" href="#menu"><T space>{"Find your favorite"}</T><ArrowUpRight size={18}/>
            </a>
            <a className="text-link" href="#craft"><T space>{"Meet the ingredients"}</T><ArrowDown size={15}/>
            </a>
          </div>
        </div>
        <div className="house-hero-art">
          <div className="hero-orbit orbit-one"/>
          <div className="hero-orbit orbit-two"/>
          <span className="orbit-caption"><T space>{"THE SIMPLE THINGS, DONE BEAUTIFULLY."}</T></span>
          <Suspense fallback={<PizzaFallback />}>
            <PizzaScene finish={finish} paused={paused}/>
          </Suspense>
        </div>
        <div className="house-stamp hero-enter">
          <span><T space>{"LESS ORDINARY"}</T></span>
          <Flame size={28}/>
          <span><T space>{"MORE DELICIOUS"}</T></span>
        </div>
        <div className="hero-product-caption hero-enter">
          <span className="caption-rule"/>
          <div>
            <span><T space>{"THE HOUSE MARGHERITA"}</T></span>
            <small><T space>{"Tomato. Mozzarella. Basil. Happiness."}</T></small>
          </div>
          <b>01</b>
        </div>
        <div className="house-hero-bottom">
          <a href="#craft">
            <span className="scroll-circle">
              <MoveDown size={17}/>
            </span><T space>{"SCROLL. THERE\u2019S MORE TO LOVE."}</T></a>
          <span><T space>{"BEST ENJOYED TOGETHER"}</T><span className="little-star">✳</span>
          </span>
        </div>
      </section>
      <div className="house-marquee" aria-label="Good food. No small talk. Pizza. Burgers. Fries. Your table is ready.">
        <div aria-hidden="true">
          <T>{[0, 1].map((i) => (<span key={i}><T space>{"GOOD FOOD, NO SMALL TALK."}</T><b>✳</b><T space>{"PIZZA. BURGERS. FRIES."}</T><b>✳</b><T space>{" "}</T><T space>{"YOUR TABLE IS READY."}</T><b>✳</b><T space>{" "}</T>
            </span>))}</T>
        </div>
      </div>
      <section className="house-intro home-arrival" id="craft">
        <span className="eyebrow"><T space>{"A CLOSER LOOK / A LITTLE OBSESSION"}</T></span>
        <div>
          <h2><T space>{"Simple ingredients."}</T><br />
            <em><T space>{"Extraordinary together."}</T></em>
          </h2>
          <p><T space>{"Good food has nothing to hide."}</T><br /><T space>{"Scroll to take our house original apart."}</T><br />
            <span><T space>{"Then watch it all come together."}</T></span>
          </p>
        </div>
      </section>
      <section className="pizza-journey" aria-label="The house margherita: a three chapter ingredient story">
        <div className="journey-topline">
          <span><T space>{"PIZZA HOUSE / ANATOMY OF A FAVORITE"}</T></span>
          <a href="#menu"><T space>{"STRAIGHT TO THE MENU"}</T><ArrowUpRight size={14}/>
          </a>
        </div>
        <div className="journey-word" aria-hidden="true"><T space>{"THE GOOD STUFF."}</T></div>
        <div className="journey-halo" aria-hidden="true"/>
        <div className="journey-chapters">
          <T>{chapters.map((chapter, i) => (<div className="journey-chapter" key={chapter.tag} data-chapter={i}>
              <span className="eyebrow"><T>{chapter.tag}</T></span>
              <h2><T>{chapter.title}</T></h2>
              <p><T>{chapter.text}</T></p>
              <T>{i === 3 && (<a href="#pizza-studio" className="pill journey-cta"><T space>{"Make it a pizza night"}</T><ArrowUpRight size={17}/>
                </a>)}</T>
            </div>))}</T>
        </div>
        <Suspense fallback={<PizzaFallback />}>
          <PizzaScene reveal finish={finish} paused={paused}/>
        </Suspense>
        <div className="ingredient-labels" aria-hidden="true">
          <span>
            01 <b><T space>{"Fresh basil"}</T></b>
            <i />
          </span>
          <span>
            02 <b><T space>{"Mozzarella & tomato"}</T></b>
            <i />
          </span>
          <span>
            03 <b><T space>{"Golden pizza base"}</T></b>
            <i />
          </span>
        </div>
        <div className="journey-bottom">
          <div className="journey-steps">
            <span className="is-active">
              01 <b><T space>{"THE CRUSH"}</T></b>
            </span>
            <span>
              02 <b><T space>{"THE GOOD STUFF"}</T></b>
            </span>
            <span>
              03 <b><T space>{"ALL TOGETHER"}</T></b>
            </span>
            <span>
              04 <b><T space>{"YOUR FIRST BITE"}</T></b>
            </span>
          </div>
          <span className="journey-scroll"><T space>{"KEEP SCROLLING"}</T><ArrowDown size={14}/>
          </span>
          <div className="journey-progress">
            <i />
          </div>
        </div>
      </section>
      <div className="house-finish">
        <div>
          <span className="eyebrow"><T space>{"A FINAL LITTLE TOUCH"}</T></span>
          <p><T space>{"Your pizza. Your kind of table."}</T></p>
        </div>
        <div className="finish-options" role="group" aria-label="Choose the 3D plate color">
          <T>{(["Ivory", "Charcoal", "Terracotta"] as const).map((color) => (<button key={color} className={finish === color ? "selected" : ""} aria-pressed={finish === color} onClick={() => setFinish(color)}>
              <i data-finish={color}/>
              <T>{color}</T>
            </button>))}</T>
        </div>
        <a href="#craft" className="text-link"><T space>{"Take another look"}</T><ArrowUpRight size={16}/>
        </a>
      </div>
      <PizzaCustomizer paused={paused}/>
      <Offers />
      <Catalog />
      <KitchenStory />
      <section className="story house-story" id="story">
        <div className="home-arrival">
          <span className="eyebrow"><T space>{"OUR KIND OF HAPPY PLACE"}</T></span>
          <h2><T space>{"Full table."}</T><br />
            <em><T space>{"Full heart."}</T></em>
          </h2>
          <p><T space>{"The last slice. The shared fries. The conversations that run a little longer. That\u2019s the feeling behind Pizza House."}</T></p>
          <a className="pill" href="#menu"><T space>{"Bring something good to the table"}</T><ArrowUpRight size={18}/>
          </a>
        </div>
        <div className="story-gallery home-arrival">
          <img src="/images/kitchen.jpg" alt="Pizza with basil and tomatoes" loading="lazy"/>
          <img src="/images/fries.jpg" alt="Golden fries ready to share" loading="lazy"/>
          <span><T space>{"GOOD THINGS ARE BETTER TOGETHER. \u2197"}</T></span>
        </div>
      </section>
    </div>);
}
