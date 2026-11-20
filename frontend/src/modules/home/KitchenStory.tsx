import { T } from "../../app/Locale";
export function KitchenStory() {
    return (<section className="kitchen-story" aria-labelledby="kitchen-title">
      <div className="kitchen-heading home-arrival">
        <span className="eyebrow"><T space>{"FLOUR. FIRE. A LITTLE PATIENCE."}</T></span>
        <h2 id="kitchen-title"><T space>{"Before the first bite,"}</T><br />
          <em><T space>{"there\u2019s a little craft."}</T></em>
        </h2>
        <p><T space>{"A closer look at the small things that make pizza worth gathering around."}</T></p>
      </div>
      <div className="kitchen-frames">
        <figure className="kitchen-frame home-arrival">
          <div>
            <img src="/images/kitchen-dough.jpg" width="1000" height="1250" loading="lazy" decoding="async" alt="Flour-dusted hands gently kneading dough on a wooden surface"/>
          </div>
          <figcaption>
            <span><T space>{"01 / THE BEGINNING"}</T></span>
            <h3><T space>{"Good things take shape."}</T></h3>
            <p><T space>{"Flour on the table. Hands in the dough. The simple joy of making something from scratch."}</T></p>
          </figcaption>
        </figure>
        <figure className="kitchen-frame home-arrival">
          <div>
            <img src="/images/kitchen-oven.jpg" width="1200" height="900" loading="lazy" decoding="async" alt="Pizza baking beside glowing flames in a wood-fired oven"/>
          </div>
          <figcaption>
            <span><T space>{"02 / A LITTLE FIRE"}</T></span>
            <h3><T space>{"That golden moment."}</T></h3>
            <p><T space>{"The bubbling cheese. The toasted edge. The moment a few good ingredients become a pizza."}</T></p>
          </figcaption>
        </figure>
      </div>
      <p className="photo-credits"><T space>{"Kitchen inspiration photography:"}</T><T space>{" "}</T>
        <a href="https://unsplash.com/photos/person-making-dough-beside-brown-wooden-rolling-pin-tOYiQxF9-Ys" target="_blank" rel="noreferrer"><T space>{"Nadya Spetnitskaya"}</T></a><T space>{" "}</T>
        &<T space>{" "}</T>
        <a href="https://unsplash.com/photos/a-close-up-of-a-pizza-in-an-oven-yzIvt5rBfS0" target="_blank" rel="noreferrer"><T space>{"Oscar Ramirez"}</T></a><T space>{" "}</T><T space>{"/ Unsplash."}</T></p>
    </section>);
}
