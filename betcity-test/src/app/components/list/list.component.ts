import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {catchError, finalize, map, takeUntil} from 'rxjs/operators';
import {BehaviorSubject, EMPTY, Observable, Subject} from 'rxjs';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {isNullOrUndefined} from 'util';
import {ListInterface, ListService} from '../../list.service';
import {CdkVirtualScrollViewport} from '@angular/cdk/scrolling';

const LOCAL_STORAGE_KEY = 'betCityList';

@Component({
	selector: 'app-list',
	templateUrl: './list.component.html',
	styleUrls: ['./list.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListComponent implements OnInit, OnDestroy {

	public resultsItem$: BehaviorSubject<ListItemInterface[]> = new BehaviorSubject<ListItemInterface[]>([]);
	public favouriteItems$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
	public list$: Observable<ListItemInterface[]>;
	public formGroup: FormGroup;
	public itemSize = 40;
	public isBusy$ = new Subject<boolean>();
	@ViewChild('virtualScroll', {static: false})
	private _virtualScroll: CdkVirtualScrollViewport;
	private _destroy$ = new Subject();
	private _nextPageToken = null;
	private _totalResults = 0;

	constructor(private _listService: ListService,
				private _fb: FormBuilder) {

		this.formGroup = this._fb.group({
			filterTitle: new FormControl(null),
			pagingSize: new FormControl(20),
			onlyFavourites: new FormControl(false)
		});

		if (!isNullOrUndefined(localStorage.getItem(LOCAL_STORAGE_KEY))) {
			const localStorageValue = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
			this.favouriteItems$.next(localStorageValue.list);
		}

		this.formGroup.get('onlyFavourites').valueChanges
			.pipe(
				takeUntil(this._destroy$)
			).subscribe(value => {
			this.formGroup.get('filterTitle').patchValue(null);
			if (value) {
				this.list$ = this.resultsItem$
					.pipe(
						map(i => {
							return i.filter(j => this.favouriteItems$.value.includes(j.id));
						})
					);
			} else {
				this.list$ = this.resultsItem$;
			}
		});

		this.formGroup.get('pagingSize').valueChanges
			.pipe(
				takeUntil(this._destroy$)
			).subscribe(value => {
			this.getList(value, null);
		});

		this.formGroup.get('filterTitle').valueChanges
			.pipe(
				takeUntil(this._destroy$),
			)
			.subscribe(query => {
				if (!isNullOrUndefined(query)) {
					this.list$ = this.resultsItem$.pipe(
						map(items => items.filter(i => i.title.toLowerCase().indexOf(query.toLowerCase()) >= 0))
					);
				}
			});
	}

	ngOnInit() {
		this.list$ = this.resultsItem$;
		this.getList(this.formGroup.controls['pagingSize'].value, null);
	}

	public trackByFn(item: ListItemInterface): string {
		return item.id;
	}

	public onScroll(event) {
		const total = this._virtualScroll.getDataLength();
		const buffer = Math.floor(this._virtualScroll.getViewportSize() / this.itemSize);
		if ((this._totalResults > this.resultsItem$.value.length + 1)
			&& isNullOrUndefined(this.formGroup.get('filterTitle').value)
			&& (total <= event + buffer)) {
			this.getList(this.formGroup.controls['pagingSize'].value, this._nextPageToken);
		}
	}

	public toggleFavourite(itemList: ListItemInterface) {
		let favouriteList = this.favouriteItems$.value;
		if (this.isFavouriteItem(itemList.id)) {
			itemList.isFavourite = false;
			favouriteList = favouriteList.filter(i => i !== itemList.id);
		} else {
			itemList.isFavourite = true;
			favouriteList.push(itemList.id);
		}

		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({list: favouriteList}));
		this.favouriteItems$.next(favouriteList);
	}

	ngOnDestroy(): void {
		this._destroy$.next();
	}

	private getList(limit: string, nextPageToken: string) {
		this.isBusy$.next(true);
		this._listService.getList(limit, nextPageToken)
			.pipe(
				catchError(() => EMPTY),
				finalize(() => this.isBusy$.next(false))
			)
			.subscribe((response: ListInterface) => {
				this._nextPageToken = response.nextPageToken;
				this._totalResults = response.pageInfo.totalResults;
				let resultModels = response.items.map(i => responseToModel(i, this.isFavouriteItem(i.id)));
				if (nextPageToken) {
					resultModels = this.resultsItem$.value.concat(resultModels);
				}
				this.resultsItem$.next(resultModels);
				if (!nextPageToken) {
					this._virtualScroll.scrollToIndex(0);
				}
		});
	}

	private isFavouriteItem(itemId: string): boolean {
		return this.favouriteItems$.value.includes(itemId);
	}
}

function responseToModel(response: any, isFavourite?: boolean) {
	return <ListItemInterface> {
		id: response.id,
		title: response.snippet.title,
		chanelTitle: response.snippet.chanelTitle,
		description: response.snippet.description,
		playListId: response.snippet.playListId,
		isFavourite: isFavourite ? isFavourite : false
	};
}

export interface ListItemInterface {
	id: string;
	chanelTitle: string;
	description: string;
	playListId: string;
	publisheAt: Date;
	title: string;
	isFavourite: boolean;
}
