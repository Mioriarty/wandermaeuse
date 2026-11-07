<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\LegalController;
use App\Http\Controllers\NewsletterController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\TripController;
use Illuminate\Support\Facades\Route;

/*
 * Public site. German URLs throughout - they are what people see and share.
 */
Route::get('/', HomeController::class)->name('home');

Route::get('/blog', [PostController::class, 'index'])->name('posts.index');
Route::get('/blog/{slug}', [PostController::class, 'show'])->name('posts.show');
Route::post('/blog/{slug}/kommentare', [CommentController::class, 'store'])->name('comments.store');

Route::get('/reise', TripController::class)->name('trip');

Route::get('/newsletter', [NewsletterController::class, 'index'])->name('newsletter.index');
Route::post('/newsletter', [NewsletterController::class, 'subscribe'])->name('newsletter.subscribe');
Route::get('/newsletter/bestaetigen/{token}', [NewsletterController::class, 'confirm'])->name('newsletter.confirm');
Route::get('/newsletter/abmelden/{token}', [NewsletterController::class, 'unsubscribe'])->name('newsletter.unsubscribe');

Route::get('/impressum', [LegalController::class, 'imprint'])->name('imprint');
Route::get('/datenschutz', [LegalController::class, 'privacy'])->name('privacy');

Route::get('/feed.xml', [FeedController::class, 'rss'])->name('feed');
Route::get('/sitemap.xml', [FeedController::class, 'sitemap'])->name('sitemap');

/*
 * Admin. Desktop-first and behind a login; there is no registration.
 */
Route::prefix('admin')->name('admin.')->group(function () {
    Route::middleware('guest')->group(function () {
        Route::get('login', [Admin\AuthController::class, 'show'])->name('login');
        Route::post('login', [Admin\AuthController::class, 'login']);
    });

    Route::middleware('auth')->group(function () {
        Route::post('logout', [Admin\AuthController::class, 'logout'])->name('logout');

        Route::get('/', Admin\DashboardController::class)->name('dashboard');

        Route::get('startseite', [Admin\HomeSettingsController::class, 'edit'])->name('home.edit');
        Route::put('startseite', [Admin\HomeSettingsController::class, 'update'])->name('home.update');

        Route::get('eintraege', [Admin\PostController::class, 'index'])->name('posts.index');
        Route::get('eintraege/neu', [Admin\PostController::class, 'create'])->name('posts.create');
        Route::post('eintraege', [Admin\PostController::class, 'store'])->name('posts.store');
        Route::get('eintraege/{post}', [Admin\PostController::class, 'edit'])->name('posts.edit');
        Route::put('eintraege/{post}', [Admin\PostController::class, 'update'])->name('posts.update');
        Route::delete('eintraege/{post}', [Admin\PostController::class, 'destroy'])->name('posts.destroy');

        Route::post('eintraege/{post}/komposition', [Admin\CompositionController::class, 'save'])->name('compositions.save');
        Route::delete('eintraege/{post}/komposition', [Admin\CompositionController::class, 'destroy'])->name('compositions.destroy');

        Route::get('bilder', [Admin\MediaController::class, 'index'])->name('media.index');
        Route::post('bilder', [Admin\MediaController::class, 'store'])->name('media.store');
        Route::put('bilder/{medium}', [Admin\MediaController::class, 'update'])->name('media.update');
        Route::delete('bilder/{medium}', [Admin\MediaController::class, 'destroy'])->name('media.destroy');

        Route::get('stationen', [Admin\StopController::class, 'index'])->name('stops.index');
        Route::post('stationen', [Admin\StopController::class, 'store'])->name('stops.store');
        Route::put('stationen/reihenfolge', [Admin\StopController::class, 'reorder'])->name('stops.reorder');
        Route::put('stationen/{stop}', [Admin\StopController::class, 'update'])->name('stops.update');
        Route::delete('stationen/{stop}', [Admin\StopController::class, 'destroy'])->name('stops.destroy');

        Route::get('unterkuenfte', [Admin\BookingController::class, 'index'])->name('bookings.index');
        Route::post('unterkuenfte', [Admin\BookingController::class, 'store'])->name('bookings.store');
        Route::put('unterkuenfte/{booking}', [Admin\BookingController::class, 'update'])->name('bookings.update');
        Route::delete('unterkuenfte/{booking}', [Admin\BookingController::class, 'destroy'])->name('bookings.destroy');

        Route::get('kommentare', [Admin\CommentController::class, 'index'])->name('comments.index');
        Route::delete('kommentare/{comment}', [Admin\CommentController::class, 'destroy'])->name('comments.destroy');
        Route::delete('kommentare', [Admin\CommentController::class, 'bulkDestroy'])->name('comments.bulk-destroy');

        Route::get('newsletter', [Admin\NewsletterController::class, 'index'])->name('newsletter.index');
        Route::post('newsletter', [Admin\NewsletterController::class, 'store'])->name('newsletter.store');
        Route::put('newsletter/{campaign}', [Admin\NewsletterController::class, 'update'])->name('newsletter.update');
        Route::post('newsletter/{campaign}/senden', [Admin\NewsletterController::class, 'send'])->name('newsletter.send');
        Route::delete('newsletter/{campaign}', [Admin\NewsletterController::class, 'destroy'])->name('newsletter.destroy');
        Route::delete('newsletter/empfaenger/{subscriber}', [Admin\NewsletterController::class, 'destroySubscriber'])->name('newsletter.subscribers.destroy');
    });
});
